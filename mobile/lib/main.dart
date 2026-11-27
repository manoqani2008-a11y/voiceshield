import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:record/record.dart';
import 'package:vibration/vibration.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

void main() {
  runApp(const VoiceShieldApp());
}

class VoiceShieldApp extends StatelessWidget {
  const VoiceShieldApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VoiceShield',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0B0E1E),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF6366F1),
          surface: Color(0xFF141834),
        ),
        textTheme: GoogleFonts.plusJakartaSansTextTheme(
          ThemeData.dark().textTheme,
        ),
      ),
      home: const CallScreen(),
    );
  }
}

enum CallStatus { incoming, active, ended }

class CallScreen extends StatefulWidget {
  const CallScreen({super.key});

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> with TickerProviderStateMixin {
  CallStatus _status = CallStatus.incoming;
  String _serverUrl = 'https://voiceshield-ebon.vercel.app';
  WebSocketChannel? _channel;
  bool _isWsConnected = false;

  final AudioRecorder _recorder = AudioRecorder();
  StreamSubscription<Uint8List>? _audioSub;
  final List<int> _pcmBuffer = [];
  bool _isAuditingGemini = false;
  bool _hasVibrated = false;

  int _callSeconds = 0;
  Timer? _timer;
  int _riskScore = 4;
  int _maxRisk = 4;
  double _currentRms = 0.0;
  String _geminiSummary = "Ovoz kuzatilmoqda...";
  String _simMode = 'mic'; // 'mic', 'real', 'fake'

  late AnimationController _waveController;
  final Random _random = Random();

  @override
  void initState() {
    super.initState();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _waveController.dispose();
    _timer?.cancel();
    _stopAudioCapture();
    _recorder.dispose();
    super.dispose();
  }

  Uri _buildHttpUri(String path) {
    final normalized = _serverUrl.trim().replaceAll(RegExp(r'/$'), '');
    final base = normalized.startsWith('http://') || normalized.startsWith('https://')
        ? normalized
        : 'http://$normalized';
    return Uri.parse('$base$path');
  }

  Uri? _buildWsUri() {
    final normalized = _serverUrl.trim().replaceAll(RegExp(r'/$'), '');
    if (normalized.contains('vercel.app')) return null;
    if (normalized.startsWith('https://')) {
      return Uri.parse('${normalized.replaceFirst('https://', 'wss://')}/ws/audio');
    }
    if (normalized.startsWith('http://')) {
      return Uri.parse('${normalized.replaceFirst('http://', 'ws://')}/ws/audio');
    }
    return Uri.parse('ws://$normalized/ws/audio');
  }

  void _connectWebSocket() {
    final wsUrl = _buildWsUri();
    if (wsUrl == null) {
      setState(() => _isWsConnected = false);
      return;
    }
    try {
      _channel = WebSocketChannel.connect(wsUrl);
      setState(() => _isWsConnected = true);

      _channel!.stream.listen(
        (data) {
          final res = jsonDecode(data.toString());
          if (res['ai_probability'] != null && mounted) {
            final score = (res['ai_probability'] as num).toInt();
            _applyRiskScore(score);
          }
        },
        onError: (_) {
          if (mounted) setState(() => _isWsConnected = false);
        },
        onDone: () {
          if (mounted) setState(() => _isWsConnected = false);
        },
      );
    } catch (_) {
      if (mounted) setState(() => _isWsConnected = false);
    }
  }

  void _applyRiskScore(int score) {
    setState(() {
      _riskScore = score.clamp(0, 100);
      if (_riskScore > _maxRisk) _maxRisk = _riskScore;
    });
    if (_riskScore >= 70 && !_hasVibrated) {
      _hasVibrated = true;
      Vibration.hasVibrator().then((has) {
        if (has == true) Vibration.vibrate(duration: 350);
      }).catchError((_) {});
    } else if (_riskScore < 50) {
      _hasVibrated = false;
    }
  }

  Future<void> _startMicCapture() async {
    try {
      final permitted = await _recorder.hasPermission();
      if (!permitted) {
        if (mounted) {
          setState(() {
            _geminiSummary = "Mikrofon ruxsati berilmadi (simulyatsiya yoqildi)";
            _simMode = 'real';
          });
        }
        return;
      }

      final stream = await _recorder.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
        ),
      );

      _pcmBuffer.clear();
      _audioSub = stream.listen((chunk) {
        if (_status != CallStatus.active) return;

        // WebSocket serverga PCM uzatish
        if (_isWsConnected && _channel != null) {
          try {
            _channel!.sink.add(chunk);
          } catch (_) {}
        }

        // PCM RMS energiyasini hisoblash va Gemini buferiga yig'ish
        final bd = ByteData.sublistView(chunk);
        double sumSq = 0;
        int zc = 0;
        int prev = 0;
        final count = chunk.length ~/ 2;
        for (int i = 0; i < count; i++) {
          final sample = bd.getInt16(i * 2, Endian.little);
          final norm = sample / 32768.0;
          sumSq += norm * norm;
          if (i > 0 && ((sample >= 0 && prev < 0) || (sample < 0 && prev >= 0))) {
            zc++;
          }
          prev = sample;
        }
        final rms = count > 0 ? sqrt(sumSq / count) : 0.0;
        final zcr = count > 0 ? zc / count : 0.0;

        if (!_isWsConnected && mounted) {
          setState(() => _currentRms = rms);
          if (rms < 0.010) {
            _applyRiskScore(max(6, (_riskScore * 0.88).round()));
          } else if (zcr > 0.055 && zcr < 0.16 && rms > 0.025) {
            _applyRiskScore(min(78, _riskScore + 6));
          } else {
            _applyRiskScore(max(8, min(30, (_riskScore * 0.7 + 12 * 0.3).round())));
          }
        } else if (mounted) {
          setState(() => _currentRms = rms);
        }

        _pcmBuffer.addAll(chunk);
        // Har ~3 soniyalik nutqdan keyin (16kHz * 2 bayt * 3s = 96,000 bayt) Gemini tekshiruvi
        if (_pcmBuffer.length >= 96000 && !_isAuditingGemini) {
          final clip = Uint8List.fromList(_pcmBuffer.take(96000).toList());
          _pcmBuffer.clear();
          _auditPcmWithGemini(clip);
        } else if (_pcmBuffer.length > 160000) {
          _pcmBuffer.removeRange(0, _pcmBuffer.length - 96000);
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() => _geminiSummary = "Mikrofon xatosi: lokal rejim faol");
      }
    }
  }

  Uint8List _wrapPcmAsWav(Uint8List pcm, {int sampleRate = 16000}) {
    final totalSize = 44 + pcm.length;
    final out = ByteData(totalSize);
    void writeStr(int offset, String s) {
      for (int i = 0; i < s.length; i++) {
        out.setUint8(offset + i, s.codeUnitAt(i));
      }
    }

    writeStr(0, 'RIFF');
    out.setUint32(4, 36 + pcm.length, Endian.little);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    out.setUint32(16, 16, Endian.little);
    out.setUint16(20, 1, Endian.little);
    out.setUint16(22, 1, Endian.little);
    out.setUint32(24, sampleRate, Endian.little);
    out.setUint32(28, sampleRate * 2, Endian.little);
    out.setUint16(32, 2, Endian.little);
    out.setUint16(34, 16, Endian.little);
    writeStr(36, 'data');
    out.setUint32(40, pcm.length, Endian.little);

    final bytes = out.buffer.asUint8List();
    bytes.setRange(44, totalSize, pcm);
    return bytes;
  }

  Future<void> _auditPcmWithGemini(Uint8List pcm) async {
    if (_status != CallStatus.active || _isAuditingGemini) return;
    _isAuditingGemini = true;
    try {
      final wavBytes = _wrapPcmAsWav(pcm);
      final res = await http
          .post(
            _buildHttpUri('/api/gemini/analyze'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'audio_base64': base64Encode(wavBytes),
              'mime_type': 'audio/wav',
            }),
          )
          .timeout(const Duration(seconds: 12));

      if (res.statusCode == 200 && mounted && _status == CallStatus.active) {
        final data = jsonDecode(res.body);
        if (data['success'] == true) {
          final score = (data['risk_score'] as num?)?.toInt() ?? 10;
          final reason = (data['reasons'] ?? 'Gemini tahlili yakunlandi').toString();
          setState(() => _geminiSummary = reason);
          _applyRiskScore(score);
        }
      }
    } catch (_) {
      // Tarmoq uzilgan bo'lsa lokal DSP davom etadi
    } finally {
      _isAuditingGemini = false;
    }
  }

  Future<void> _stopAudioCapture() async {
    await _audioSub?.cancel();
    _audioSub = null;
    try {
      if (await _recorder.isRecording()) {
        await _recorder.stop();
      }
    } catch (_) {}
    _channel?.sink.close();
    _channel = null;
    _isWsConnected = false;
  }

  void _answerCall() {
    setState(() {
      _status = CallStatus.active;
      _callSeconds = 0;
      _riskScore = 4;
      _maxRisk = 4;
      _currentRms = 0.0;
      _hasVibrated = false;
      _geminiSummary = _simMode == 'mic' ? "Jonli mikrofon tinglanmoqda..." : "Simulyatsiya faol";
    });

    if (_simMode == 'mic') {
      _connectWebSocket();
      _startMicCapture();
    }

    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        _callSeconds++;
        if (_simMode == 'fake') {
          if (_callSeconds > 2) {
            _riskScore = min(94, 25 + (_callSeconds - 2) * 14 + _random.nextInt(6));
          }
          if (_riskScore > _maxRisk) _maxRisk = _riskScore;
        } else if (_simMode == 'real') {
          _riskScore = 5 + _random.nextInt(5);
          if (_riskScore > _maxRisk) _maxRisk = _riskScore;
        }
      });
    });
  }

  void _rejectCall() {
    _timer?.cancel();
    _stopAudioCapture();
    setState(() {
      _status = CallStatus.incoming;
      _callSeconds = 0;
      _riskScore = 4;
    });
  }

  void _endCall() {
    _timer?.cancel();
    _stopAudioCapture();
    setState(() {
      _status = CallStatus.ended;
    });
  }

  Future<void> _reportIncident() async {
    try {
      await http
          .post(
            _buildHttpUri('/api/report-incident'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'caller_number': '+998 (90) 123-45-67',
              'call_duration': '${(_callSeconds ~/ 60).toString().padLeft(2, '0')}:${(_callSeconds % 60).toString().padLeft(2, '0')}',
              'max_risk_score': _maxRisk,
              'notes': _geminiSummary,
            }),
          )
          .timeout(const Duration(seconds: 5));
    } catch (_) {}
  }

  void _openVerifySheet() {
    final otpCode = (1000 + _random.nextInt(9000)).toString();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF141834),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          bool isReported = false;

          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 20),
                if (!isReported) ...[
                  const Text(
                    "🔐 Ikkinchi Kanal Tasdiqlash",
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    "Rahbarning haqiqiy raqamiga (SMS / Telegram) bir martalik maxfiy kod jo'natildi. Suhbatdoshdan ushbu kodni aytishini talab qiling:",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white10,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: Text(
                      otpCode,
                      style: GoogleFonts.jetbrainsMono(
                        fontSize: 34,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 8,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFEF4444),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          onPressed: () {
                            _reportIncident();
                            setSheetState(() => isReported = true);
                          },
                          child: const Text("Kod aytilmadi (Firibgar)"),
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  const Icon(Icons.shield, color: Color(0xFF10B981), size: 60),
                  const SizedBox(height: 12),
                  const Text(
                    "Firibgarlik oldi olindi!",
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    "Qo'ng'iroq 'Deepfake Hujumi' deb belgilandi va xavfsizlik bo'limiga hisobot yuborildi.",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _endCall();
                    },
                    child: const Text("Qo'ng'iroqni zudlik bilan uzish"),
                  ),
                ],
                const SizedBox(height: 16),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showSettingsDialog() {
    final controller = TextEditingController(text: _serverUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF141834),
        title: const Text("Server Sozlamalari"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              "Vercel yoki Python backend manzili (masalan: https://voiceshield-ebon.vercel.app yoki http://192.168.1.10:8000):",
              style: TextStyle(fontSize: 12, color: Colors.white70),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white10,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Bekor qilish"),
          ),
          ElevatedButton(
            onPressed: () {
              setState(() => _serverUrl = controller.text.trim());
              Navigator.pop(ctx);
            },
            child: const Text("Saqlash"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF6366F1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.security, size: 18),
            ),
            const SizedBox(width: 10),
            const Text(
              'VoiceShield',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: _showSettingsDialog,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: _buildCurrentView(),
        ),
      ),
    );
  }

  Widget _buildCurrentView() {
    switch (_status) {
      case CallStatus.incoming:
        return _buildIncomingView();
      case CallStatus.active:
        return _buildActiveCallView();
      case CallStatus.ended:
        return _buildEndedView();
    }
  }

  Widget _buildIncomingView() {
    return Column(
      children: [
        const Spacer(flex: 1),
        Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFF6366F1), Color(0xFF06B6D4)],
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF6366F1).withOpacity(0.4),
                blurRadius: 30,
              )
            ],
          ),
          child: const Center(
            child: Icon(Icons.business, size: 48, color: Colors.white),
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          "Direktor (Ofis)",
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        const Text(
          "+998 (90) 123-45-67",
          style: TextStyle(fontSize: 15, color: Colors.white60),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFF10B981).withOpacity(0.15),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shield, color: Color(0xFF10B981), size: 14),
              SizedBox(width: 6),
              Text(
                "AI Himoyasi Yoqilgan",
                style: TextStyle(
                  color: Color(0xFF10B981),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        const Spacer(flex: 2),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: const Color(0xFF141834),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white12),
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _simMode = 'mic'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _simMode == 'mic' ? const Color(0xFF10B981) : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(
                      child: Text("Jonli Mic", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _simMode = 'real'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _simMode == 'real' ? const Color(0xFF6366F1) : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(
                      child: Text("Sim: Inson", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _simMode = 'fake'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _simMode == 'fake' ? const Color(0xFFEF4444) : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(
                      child: Text("Sim: Deepfake", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildCallButton(
              color: const Color(0xFFEF4444),
              icon: Icons.call_end,
              label: "Rad etish",
              onTap: _rejectCall,
            ),
            _buildCallButton(
              color: const Color(0xFF10B981),
              icon: Icons.call,
              label: "Javob berish",
              onTap: _answerCall,
            ),
          ],
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildActiveCallView() {
    final isDanger = _riskScore >= 70;
    final isWarning = _riskScore >= 35 && !isDanger;
    final color = isDanger
        ? const Color(0xFFEF4444)
        : isWarning
            ? const Color(0xFFF59E0B)
            : const Color(0xFF10B981);

    final durationStr =
        "${(_callSeconds ~/ 60).toString().padLeft(2, '0')}:${(_callSeconds % 60).toString().padLeft(2, '0')}";

    return Column(
      children: [
        const Text(
          "Direktor (Ofis)",
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        Text(
          "$durationStr • ${_simMode == 'mic' ? 'Jonli AI Tahlil' : 'Simulyatsiya'}",
          style: GoogleFonts.jetbrainsMono(color: Colors.white60, fontSize: 13),
        ),
        const SizedBox(height: 20),

        // Haqiqiy RMS asosidagi jonli ovoz to'lqini
        Container(
          height: 60,
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF141834),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: List.generate(24, (index) {
              return AnimatedBuilder(
                animation: _waveController,
                builder: (context, child) {
                  final base = _simMode == 'mic' ? min(1.0, _currentRms * 12.0) : 0.65;
                  final h = 6.0 + max(0.08, base) * _random.nextDouble() * (isDanger ? 38.0 : 28.0);
                  return Container(
                    width: 4,
                    height: h,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.85),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  );
                },
              );
            }),
          ),
        ),
        const SizedBox(height: 20),

        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF141834),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: color.withOpacity(0.3)),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    "$_riskScore%",
                    style: GoogleFonts.jetbrainsMono(
                      fontSize: 52,
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      isDanger ? "DEEPFAKE" : isWarning ? "SHUBHALI" : "XAVFSIZ",
                      style: TextStyle(
                        color: color,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _geminiSummary,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: _riskScore / 100.0,
                  backgroundColor: Colors.white10,
                  valueColor: AlwaysStoppedAnimation(color),
                  minHeight: 8,
                ),
              ),
            ],
          ),
        ),

        if (isDanger) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444).withOpacity(0.18),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFEF4444)),
            ),
            child: const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 28),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "OGOHLANTIRISH! PUL O'TKAZMANG!",
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        "Ovoz sun'iy klonlangan deb baholandi.",
                        style: TextStyle(color: Colors.white70, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white12,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: Colors.white24),
                ),
              ),
              onPressed: _openVerifySheet,
              icon: const Icon(Icons.lock_outline, size: 18),
              label: const Text("Ikkinchi kanal orqali tasdiqlash"),
            ),
          ),
        ],

        const Spacer(),
        _buildCallButton(
          color: const Color(0xFFEF4444),
          icon: Icons.call_end,
          label: "Tugatish",
          onTap: _endCall,
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildEndedView() {
    final isDanger = _maxRisk >= 70;
    final color = isDanger ? const Color(0xFFEF4444) : const Color(0xFF10B981);
    final durationStr =
        "${(_callSeconds ~/ 60).toString().padLeft(2, '0')}:${(_callSeconds % 60).toString().padLeft(2, '0')}";

    return Column(
      children: [
        const Spacer(flex: 1),
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: color.withOpacity(0.2),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Icon(
              isDanger ? Icons.warning_rounded : Icons.check_circle_rounded,
              color: color,
              size: 48,
            ),
          ),
        ),
        const SizedBox(height: 20),
        Text(
          isDanger ? "Xavfli Qo'ng'iroq Yakunlandi" : "Qo'ng'iroq Tugadi",
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          isDanger
              ? "Deepfake hujumi muvaffaqiyatli aniqlandi va to'xtatildi."
              : "Ovoz parametrlarida hech qanday shubhali holat aniqlanmadi.",
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white60, fontSize: 13),
        ),
        const SizedBox(height: 30),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF141834),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white12),
          ),
          child: Column(
            children: [
              _buildSummaryRow("Davomiyligi:", durationStr),
              const Divider(color: Colors.white10, height: 20),
              _buildSummaryRow("Maksimal AI xavfi:", "$_maxRisk%"),
              const Divider(color: Colors.white10, height: 20),
              _buildSummaryRow(
                "Xulosa:",
                isDanger ? "Deepfake Hujumi" : "Xavfsiz (Inson)",
                valueColor: color,
              ),
            ],
          ),
        ),
        const Spacer(flex: 2),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6366F1),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            onPressed: () {
              setState(() {
                _status = CallStatus.incoming;
              });
            },
            child: const Text("Bosh Sahifaga Qaytish", style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildSummaryRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 14)),
        Text(
          value,
          style: TextStyle(
            color: valueColor ?? Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
      ],
    );
  }

  Widget _buildCallButton({
    required Color color,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Column(
      children: [
        GestureDetector(
          onTap: onTap,
          child: Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.4),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 28),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: Colors.white70),
        ),
      ],
    );
  }
}
