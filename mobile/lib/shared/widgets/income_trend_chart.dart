import 'package:flutter/material.dart';
import '../../core/labels/class_labels.dart';

/// One data point in an income trend — mirrors web's TrendPoint.
typedef TrendPoint = ({String month, num value});

/// A single-series "how has this moved over time" sparkline. Ported from
/// src/app/income-trend-chart.tsx, minus the pointer-hover tooltip (no
/// direct touch equivalent worth the complexity here) — the latest value
/// is shown plainly instead, since the card title already names what's
/// plotted (no legend needed, matching web's own reasoning).
class IncomeTrendChart extends StatelessWidget {
  final List<TrendPoint> data;
  final String title;
  const IncomeTrendChart({
    super.key,
    required this.data,
    this.title = 'Income trend',
  });

  @override
  Widget build(BuildContext context) {
    if (data.length < 2) return const SizedBox.shrink();

    final last = data.last;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              Text(
                'LKR ${formatAmount(last.value)}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: last.value < 0
                      ? const Color(0xFFDC2626)
                      : const Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            formatMonthLabel(last.month),
            style: const TextStyle(color: Colors.grey, fontSize: 11),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 90,
            width: double.infinity,
            child: CustomPaint(painter: _SparklinePainter(data)),
          ),
        ],
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final List<TrendPoint> data;
  _SparklinePainter(this.data);

  @override
  void paint(Canvas canvas, Size size) {
    final values = data.map((d) => d.value).toList();
    final max = values.fold<num>(0, (m, v) => v > m ? v : m);
    final min = values.fold<num>(0, (m, v) => v < m ? v : m);
    final range = (max - min) == 0 ? 1 : (max - min);

    final points = <Offset>[
      for (var i = 0; i < data.length; i++)
        Offset(
          data.length == 1
              ? size.width / 2
              : (i / (data.length - 1)) * size.width,
          size.height - ((data[i].value - min) / range) * size.height,
        ),
    ];

    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (final p in points.skip(1)) {
      linePath.lineTo(p.dx, p.dy);
    }

    final areaPath = Path.from(linePath)
      ..lineTo(points.last.dx, size.height)
      ..lineTo(points.first.dx, size.height)
      ..close();

    canvas.drawPath(
      areaPath,
      Paint()
        ..color = const Color(0xFF4F46E5).withValues(alpha: 0.08)
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      linePath,
      Paint()
        ..color = const Color(0xFF4F46E5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    canvas.drawCircle(points.last, 3, Paint()..color = const Color(0xFF4F46E5));
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) =>
      oldDelegate.data != data;
}
