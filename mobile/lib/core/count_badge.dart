import 'package:flutter/material.dart';

// The green count bubble, like the one on the WhatsApp icon. Used on tabs, the bell and menu rows.
const Color kBadgeColor = Color(0xFF1FA855);

String badgeText(int count) => count > 99 ? '99+' : '$count';

/// The bubble on its own (for list rows). Draws nothing when count is 0.
class CountBubble extends StatelessWidget {
  const CountBubble(this.count, {super.key, this.ring = false});
  final int count;
  final bool ring; // white ring so the bubble stands out when it sits on top of an icon
  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();
    return Semantics(
      label: '$count unread',
      child: Container(
        constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
        padding: const EdgeInsets.symmetric(horizontal: 6),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: kBadgeColor,
          borderRadius: BorderRadius.circular(12),
          border: ring ? Border.all(color: Colors.white, width: 2) : null,
        ),
        child: Text(badgeText(count), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800, height: 1.1)),
      ),
    );
  }
}

/// Puts the count bubble on the top-right corner of any widget (an icon, an avatar, a button).
class CountBadge extends StatelessWidget {
  const CountBadge({super.key, required this.count, required this.child});
  final int count;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    if (count <= 0) return child;
    return Stack(clipBehavior: Clip.none, children: [
      child,
      Positioned(
        top: -8, right: -12,
        child: TweenAnimationBuilder<double>(
          key: ValueKey(count), // pops again each time the number changes
          tween: Tween(begin: 0.6, end: 1), duration: const Duration(milliseconds: 260), curve: Curves.easeOutBack,
          builder: (_, v, c) => Transform.scale(scale: v, child: c),
          child: CountBubble(count, ring: true),
        ),
      ),
    ]);
  }
}
