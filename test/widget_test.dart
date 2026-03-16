import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';

import 'package:botposvendedor/app.dart';

void main() {
  testWidgets('renderiza el workspace ejecutivo (Panel)', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1600, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const FullPosApp());
    await tester.pumpAndSettle();

    expect(find.text('Panel'), findsWidgets);
    expect(find.text('Mensajes'), findsOneWidget);
    expect(find.text('© 2026 FULLTECH Systems'), findsOneWidget);
  });
}
