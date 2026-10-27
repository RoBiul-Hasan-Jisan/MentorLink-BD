import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mentorlink_bd/core/ui.dart';

// Small smoke test that needs no Firebase: the readiness ring shows its percentage.
void main() {
  testWidgets('Ring shows the percentage', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Ring(value: 0.58, dark: false))));
    expect(find.text('58%'), findsOneWidget);
  });
}
