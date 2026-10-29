import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

// Builds the CV PDF from the v2 CV data (see backend/src/services/cv.js).
// The same bytes are used for the in-app preview, the download and printing, so what you see is what you get.
// One clean column, standard headings and real text (not an image), so company screening tools can read it.

PdfColor _hex(String? h, PdfColor fallback) {
  final s = (h ?? '').replaceAll('#', '');
  if (s.length != 6) return fallback;
  final v = int.tryParse(s, radix: 16);
  return v == null ? fallback : PdfColor.fromInt(0xFF000000 | v);
}

Future<pw.ThemeData> _theme() async {
  // Fonts come from Google Fonts the first time (needs internet). Noto Sans Bengali is added for Bangla text.
  try {
    final base = await PdfGoogleFonts.notoSansRegular();
    final bold = await PdfGoogleFonts.notoSansBold();
    final italic = await PdfGoogleFonts.notoSansItalic();
    final boldItalic = await PdfGoogleFonts.notoSansBoldItalic();
    final bn = await PdfGoogleFonts.notoSansBengaliRegular();
    final bnBold = await PdfGoogleFonts.notoSansBengaliBold();
    return pw.ThemeData.withFont(base: base, bold: bold, italic: italic, boldItalic: boldItalic, fontFallback: [bn, bnBold]);
  } catch (_) {
    return pw.ThemeData.base(); // offline: built-in Helvetica (Bangla letters may be missing)
  }
}

List _l(dynamic v) => v is List ? v : const [];
Map _m(dynamic v) => v is Map ? v : const {};
String _s(dynamic v) => (v ?? '').toString().trim();

Future<Uint8List> buildCvPdf(Map cv) async {
  final compact = _s(cv['template']) == 'compact';
  final accent = _hex(_s(cv['accent']), PdfColor.fromInt(0xFF1F5FBF));
  const ink = PdfColor.fromInt(0xFF111111);
  const grey = PdfColor.fromInt(0xFF555555);
  const rule = PdfColor.fromInt(0xFFBBBBBB);
  final fs = compact ? 8.8 : 9.6; // body size
  final gap = compact ? 3.0 : 5.0;
  final doc = pw.Document(theme: await _theme(), title: _s(cv['fullName']).isEmpty ? 'CV' : '${_s(cv['fullName'])} CV', author: _s(cv['fullName']));

  pw.TextStyle st({double? size, bool bold = false, bool italic = false, PdfColor color = ink}) =>
      pw.TextStyle(fontSize: size ?? fs, color: color, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal, fontStyle: italic ? pw.FontStyle.italic : pw.FontStyle.normal);

  pw.Widget linkRow(List links, {double? size}) => pw.Wrap(children: [
        for (var i = 0; i < links.length; i++)
          pw.Row(mainAxisSize: pw.MainAxisSize.min, children: [
            pw.UrlLink(destination: _s(_m(links[i])['url']), child: pw.Text(_s(_m(links[i])['label']), style: st(size: size, color: accent).copyWith(decoration: pw.TextDecoration.underline))),
            if (i < links.length - 1) pw.Text('  |  ', style: st(size: size, color: grey)),
          ]),
      ]);

  pw.Widget title(String t) => pw.Container(
        margin: pw.EdgeInsets.only(top: compact ? 8 : 11, bottom: gap),
        padding: const pw.EdgeInsets.only(bottom: 2),
        decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: rule, width: 0.6))),
        child: pw.Text(t.toUpperCase(), style: st(size: fs + 0.6, bold: true).copyWith(letterSpacing: 0.8)),
      );

  pw.Widget bullet(String t) => pw.Padding(
        padding: const pw.EdgeInsets.only(left: 2, top: 1),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.SizedBox(width: 9, child: pw.Text('•', style: st())),
          pw.Expanded(child: pw.Text(t, style: st())),
        ]),
      );

  // ---- header ----
  final contact = _m(cv['contact']);
  final contactLine = [_s(contact['city']), _s(contact['email']), _s(contact['phone'])].where((x) => x.isNotEmpty).join('   |   ');
  final header = <pw.Widget>[
    pw.Text(_s(cv['fullName']), style: st(size: compact ? 20 : 23, bold: true)),
    if (_s(cv['headline']).isNotEmpty) pw.Padding(padding: const pw.EdgeInsets.only(top: 2), child: pw.Text(_s(cv['headline']), style: st(size: fs + 1.2, color: accent))),
    if (contactLine.isNotEmpty) pw.Padding(padding: const pw.EdgeInsets.only(top: 3), child: pw.Text(contactLine, style: st(size: fs - 0.8, color: grey))),
    if (_l(contact['links']).isNotEmpty) pw.Padding(padding: const pw.EdgeInsets.only(top: 2), child: linkRow(_l(contact['links']), size: fs - 0.6)),
    pw.Padding(padding: const pw.EdgeInsets.only(top: 6), child: pw.Divider(thickness: 1.2, color: ink, height: 1)),
  ];

  // ---- sections (order and visibility come from the CV) ----
  pw.Widget? section(String key) {
    switch (key) {
      case 'summary':
        if (_s(cv['summary']).isEmpty) return null;
        return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [title('Summary'), pw.Text(_s(cv['summary']), style: st(), textAlign: pw.TextAlign.justify)]);
      case 'skills':
        final groups = _l(cv['skills']).where((g) => _l(_m(g)['items']).isNotEmpty).toList();
        if (groups.isEmpty) return null;
        return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          title('Skills'),
          for (final g in groups)
            pw.Padding(padding: const pw.EdgeInsets.only(bottom: 1.5), child: pw.RichText(text: pw.TextSpan(children: [
              if (_s(_m(g)['label']).isNotEmpty) pw.TextSpan(text: '${_s(_m(g)['label'])}: ', style: st(bold: true)),
              pw.TextSpan(text: _l(_m(g)['items']).map(_s).join(', '), style: st()),
            ]))),
        ]);
      case 'projects':
        final ps = _l(cv['projects']);
        if (ps.isEmpty) return null;
        return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          title('Selected Projects'),
          for (final p in ps)
            pw.Container(margin: pw.EdgeInsets.only(bottom: gap + 1), child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
                pw.Expanded(child: pw.Text(_s(_m(p)['title']), style: st(size: fs + 0.6, bold: true))),
                if (_l(_m(p)['links']).isNotEmpty) linkRow(_l(_m(p)['links']), size: fs - 0.6),
              ]),
              for (final b in _l(_m(p)['bullets'])) bullet(_s(b)),
              if (_s(_m(p)['tech']).isNotEmpty)
                pw.Padding(padding: const pw.EdgeInsets.only(left: 11, top: 1), child: pw.RichText(text: pw.TextSpan(children: [pw.TextSpan(text: 'Tech: ', style: st(color: grey, bold: true)), pw.TextSpan(text: _s(_m(p)['tech']), style: st(color: grey))]))),
            ])),
        ]);
      case 'experience':
        final xs = _l(cv['experience']);
        if (xs.isEmpty) return null;
        return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          title('Experience'),
          for (final x in xs)
            pw.Container(margin: pw.EdgeInsets.only(bottom: gap + 1), child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Expanded(child: pw.RichText(text: pw.TextSpan(children: [
                  pw.TextSpan(text: _s(_m(x)['role']), style: st(size: fs + 0.6, bold: true)),
                  if (_s(_m(x)['organization']).isNotEmpty) pw.TextSpan(text: '  —  ${_s(_m(x)['organization'])}', style: st(size: fs + 0.2, color: grey)),
                ]))),
                if (_s(_m(x)['period']).isNotEmpty) pw.Text(_s(_m(x)['period']), style: st(italic: true, color: grey, size: fs - 0.4)),
              ]),
              for (final b in _l(_m(x)['bullets'])) bullet(_s(b)),
            ])),
        ]);
      case 'education':
        final es = _l(cv['education']);
        if (es.isEmpty) return null;
        return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          title('Education'),
          for (final e in es)
            pw.Container(margin: pw.EdgeInsets.only(bottom: gap), child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Expanded(child: pw.Text(_s(_m(e)['degree']), style: st(size: fs + 0.4, bold: true))),
                pw.SizedBox(width: 10),
                pw.Text(_s(_m(e)['institution']), style: st()),
              ]),
              if (_s(_m(e)['period']).isNotEmpty || _s(_m(e)['note']).isNotEmpty)
                pw.Text([_s(_m(e)['period']), _s(_m(e)['note'])].where((x) => x.isNotEmpty).join('  |  '), style: st(italic: true, color: grey, size: fs - 0.4)),
            ])),
        ]);
      case 'achievements':
        final as = _l(cv['achievements']);
        if (as.isEmpty) return null;
        return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          title('Achievements & Activities'),
          for (final a in as)
            pw.Padding(padding: const pw.EdgeInsets.only(left: 2, top: 1), child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.SizedBox(width: 9, child: pw.Text('•', style: st())),
              pw.Expanded(child: pw.RichText(text: pw.TextSpan(children: [
                if (_s(_m(a)['lead']).isNotEmpty) pw.TextSpan(text: '${_s(_m(a)['lead'])}${_s(_m(a)['text']).isEmpty ? '' : ' — '}', style: st(bold: true)),
                pw.TextSpan(text: _s(_m(a)['text']), style: st()),
              ]))),
            ])),
        ]);
      case 'languages':
        final ls = _l(cv['languages']).map(_s).where((x) => x.isNotEmpty).toList();
        if (ls.isEmpty) return null;
        return pw.Padding(padding: pw.EdgeInsets.only(top: gap + 2), child: pw.RichText(text: pw.TextSpan(children: [pw.TextSpan(text: 'Languages: ', style: st(bold: true)), pw.TextSpan(text: ls.join(', '), style: st())])));
    }
    return null;
  }

  final hidden = _l(cv['hidden']).map(_s).toSet();
  final order = _l(cv['sectionOrder']).map(_s).toList();
  final body = <pw.Widget>[];
  for (final k in order) {
    if (hidden.contains(k)) continue;
    final w = section(k);
    if (w != null) body.add(w);
  }

  doc.addPage(pw.MultiPage(
    pageFormat: PdfPageFormat.a4,
    margin: pw.EdgeInsets.symmetric(horizontal: compact ? 30 : 36, vertical: compact ? 28 : 34),
    build: (ctx) => [...header, ...body],
  ));
  return doc.save();
}
