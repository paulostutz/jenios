import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AREAS, areaUrl, type AreaId } from './navigation';
// Browser preview only: WKWebView/Android WebView cannot be certified here.
export default function Portal({ area, onChoose }: { area: AreaId; active: boolean; onChoose: () => void }) {
  return <View style={s.root}>
    <Text style={s.label}>PRÉVIA DO APP</Text><Text accessibilityRole="header" style={s.title}>JENIOS {AREAS[area].title}</Text>
    <Text style={s.body}>No Android e no iPhone, esta escolha abre a {AREAS[area].title} dentro do aplicativo, com os fluxos atuais de acesso.</Text>
    <Text style={s.note}>Nesta prévia pelo navegador, o botão abaixo abre a versão web. A sessão do aplicativo é independente da sessão deste navegador.</Text>
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(areaUrl(area))} style={s.button}><Text style={s.cta}>Abrir {AREAS[area].title} na web →</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onChoose} style={s.back}><Text style={s.body}>‹ Escolher outra área</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({ root: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101326', gap: 22 }, label: { color: '#b8a5ed', fontSize: 11, letterSpacing: 2 }, title: { color: '#fff', fontSize: 30, fontWeight: '700' }, body: { color: '#d6d3e2', fontSize: 16, lineHeight: 25, maxWidth: 440, textAlign: 'center' }, note: { color: '#aaa6bb', fontSize: 13, lineHeight: 21, maxWidth: 440, textAlign: 'center' }, button: { backgroundColor: '#c0a6ff', borderRadius: 14, padding: 18 }, cta: { color: '#21123c', fontWeight: '700' }, back: { padding: 14 } });
