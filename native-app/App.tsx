import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AREAS, type AreaId } from './src/navigation';
import Portal from './src/Portal';

export default function App() {
  // Each cold launch starts with the person's choice, never an automatic redirect.
  const [area, setArea] = useState<AreaId | null>(null);
  const [choosing, setChoosing] = useState(true);
  const choose = (next: AreaId) => { setArea(next); setChoosing(false); };
  return <SafeAreaProvider><StatusBar style="light" />
    <View style={styles.root}>
      {area && <View style={[styles.portal, choosing && styles.hidden]} accessibilityElementsHidden={choosing} importantForAccessibility={choosing ? 'no-hide-descendants' : 'auto'}>
        <Portal area={area} active={!choosing} onChoose={() => setChoosing(true)} />
      </View>}
      {choosing && <LinearGradient colors={['#17122f', '#090b16', '#0e1820']} style={styles.root}>
        <SafeAreaView style={styles.root}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.brand}>
              <Image source={require('./assets/jenios-j.webp')} accessibilityLabel="JENIOS" style={styles.logo} />
              <Text style={styles.wordmark}>JENIOS</Text><View style={styles.brandLine} /><Text style={styles.brandCaption}>SEU ECOSSISTEMA</Text>
            </View>
            <Text style={styles.eyebrow}>DUAS EXPERIÊNCIAS. UM SÓ APP.</Text>
            <Text accessibilityRole="header" style={styles.title}>Onde você quer{'\n'}estar agora?</Text>
            <Text style={styles.intro}>Escolha sua área. Você pode alternar quando quiser.</Text>
            <View style={styles.cards}>
              {Object.values(AREAS).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Entrar na JENIOS ${item.title}`} onPress={() => choose(item.id)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <LinearGradient colors={item.id === 'social' ? ['#452b72', '#251d44'] : ['#163e42', '#172b34']} style={styles.cardFill}>
                  <View style={styles.cardTop}><View style={[styles.symbol, { backgroundColor: item.tint }]}><Text style={styles.symbolText}>{item.id === 'social' ? '◎' : '↗'}</Text></View><Text style={styles.cardTag}>{item.tag}</Text></View>
                  <Text style={styles.cardTitle}>JENIOS <Text style={{ color: item.tint }}>{item.title}</Text></Text>
                  <Text style={styles.cardDescription}>{item.description}</Text>
                  <View style={styles.cardBottom}><Text style={[styles.cta, { color: item.tint }]}>Entrar na {item.title}</Text><Text style={[styles.arrow, { color: item.tint }]}>→</Text></View>
                </LinearGradient>
              </Pressable>)}
            </View>
            <Text style={styles.footer}>Seu universo de conexões, conhecimento e mercado.</Text>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>}
    </View>
  </SafeAreaProvider>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090b16' }, portal: { flex: 1 }, hidden: { display: 'none' },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28, flexGrow: 1, justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', marginBottom: 36, gap: 8 }, logo: { width: 36, height: 40, resizeMode: 'contain' },
  wordmark: { color: '#fff', fontWeight: '800', fontSize: 24, letterSpacing: 2 }, brandLine: { backgroundColor: '#423b59', width: 1, height: 20, marginHorizontal: 6 }, brandCaption: { color: '#aba5c2', fontSize: 9, letterSpacing: 1.3, flexShrink: 1 },
  eyebrow: { color: '#bca9f1', fontSize: 10, letterSpacing: 1.8, fontWeight: '700', marginBottom: 12 },
  title: { color: '#faf9ff', fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -1.1 },
  intro: { color: '#aaa6ba', fontSize: 14, lineHeight: 22, marginTop: 12, marginBottom: 26 }, cards: { gap: 16 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: '#ffffff20', overflow: 'hidden' }, pressed: { opacity: 0.82 }, cardFill: { padding: 22 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }, symbol: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, symbolText: { color: '#17212a', fontSize: 26 }, cardTag: { color: '#d3d0df', fontSize: 11, fontWeight: '600' },
  cardTitle: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 9 }, cardDescription: { color: '#c7c3d1', fontSize: 14, lineHeight: 22, maxWidth: 360 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }, cta: { fontSize: 14, fontWeight: '700' }, arrow: { fontSize: 26 },
  footer: { color: '#9a97aa', textAlign: 'center', fontSize: 11, lineHeight: 18, marginTop: 26 },
});
