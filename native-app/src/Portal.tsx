import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNetworkState } from 'expo-network';
import * as WebBrowser from 'expo-web-browser';
import {Directory, File, Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {PDF_BRIDGE_SCRIPT,validatePdfMessage} from './file-bridge';
import { AREAS, areaUrl, navigationDecision, type AreaId } from './navigation';

export type PortalProps = { area: AreaId; active: boolean; onChoose: () => void };
export default function Portal({ area, active, onChoose }: PortalProps) {
  // Explicit object generic avoids upstream WebView 14's default P=undefined.
  const ref = useRef<WebView<object>>(null);
  const [navigation, setNavigation] = useState({area, url:areaUrl(area)});
  const page=navigation.url;
  const setPage=(url:string)=>setNavigation({area,url});
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const pendingExternal = useRef(false);
  const fileBusy = useRef(false);
  const currentUrl = useRef(areaUrl(area));
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if(navigation.area!==area){
    setNavigation({area,url:areaUrl(area)}); setFailed(false); setLoading(true); setCanGoBack(false);
  }
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) ref.current?.goBack(); else onChoose();
      return true;
    });
    return () => subscription.remove();
  }, [active, canGoBack, onChoose]);
  async function sharePdf(value: NonNullable<ReturnType<typeof validatePdfMessage>>) {
    let file: File | undefined;
    try {
      if (!await Sharing.isAvailableAsync()) throw Error('Compartilhamento indisponível');
      const directory=new Directory(Paths.cache,'jenios-pdf-share');
      directory.create({idempotent:true,intermediates:true});
      const previousFiles = directory.list().filter((entry): entry is File => entry instanceof File && /^\d+-jenios-[a-zA-Z0-9_-]+\.pdf$/.test(entry.name)).sort((a,b)=>a.name.localeCompare(b.name));
      for (const [index, previous] of previousFiles.entries()) {
        if (Number(previous.name.split('-')[0]) < Date.now()-86400000 || index < previousFiles.length-4) previous.delete();
      }
      file = new File(directory, `${Date.now()}-${value.filename}`);
      file.write(value.base64, {encoding:'base64'});
      await Sharing.shareAsync(file.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Salvar ou compartilhar relatório'});
    } catch { Alert.alert('Não foi possível salvar', 'Tente gerar o relatório novamente.'); }
    finally { fileBusy.current=false; } // The recipient may read after the sheet closes. Cache is bounded/cleaned on next export.
  }
  function sharePage() {
    try {
      const url=new URL(currentUrl.current);
      if(navigationDecision(url.href)!=='internal')return;
      // Do not disclose recovery codes, tokens, private filters or form state.
      const safe=url.origin+url.pathname;
      void Share.share({title:'JENIOS '+AREAS[area].title,message:safe,url:safe}).catch(()=>{});
    } catch {}
  }
  function contactSupport() {
    Alert.alert('Falar com o suporte', 'Abrir seu aplicativo de e-mail para sac@jenios.com.br?', [
      {text:'Cancelar',style:'cancel'},
      {text:'Abrir e-mail',onPress:()=>void Linking.openURL('mailto:sac@jenios.com.br').catch(()=>Alert.alert('Contato do suporte','Envie sua mensagem para sac@jenios.com.br no aplicativo de e-mail de sua preferência.'))},
    ]);
  }
  function external(url: string) {
    if (pendingExternal.current || navigationDecision(url) !== 'external') return;
    pendingExternal.current = true;
    const done = () => { pendingExternal.current = false; };
    Alert.alert('Abrir outro site?', `Você sairá da JENIOS para acessar ${new URL(url).hostname}.`, [
      { text: 'Ficar aqui', style: 'cancel', onPress: done },
      { text: 'Abrir', onPress: () => { done(); void WebBrowser.openBrowserAsync(url).catch(() => Alert.alert('Não foi possível abrir', 'Tente novamente mais tarde.')); } },
    ], { cancelable: true, onDismiss: done });
  }
  return <SafeAreaView style={s.root}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Escolher Social ou Platform" onPress={onChoose} style={s.touch}><Text style={s.switch}>‹ Áreas</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar link da página" onPress={sharePage} style={s.touch}><Text style={s.title}>JENIOS {AREAS[area].title} ↗</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar à página anterior" disabled={!canGoBack} onPress={() => ref.current?.goBack()} style={s.touch}><Text style={[s.switch, !canGoBack && s.disabled]}>Voltar</Text></Pressable>
    </View>
    {offline && <Text accessibilityRole="alert" style={s.notice}>Sem conexão. Reconecte-se para continuar.</Text>}
    <View style={s.content}>
      <WebView<object> ref={ref} source={{ uri: page }} style={s.webview}
        applicationNameForUserAgent="JENIOS-Mobile-M02" javaScriptEnabled domStorageEnabled
        originWhitelist={['*']} mixedContentMode="never" allowFileAccess={false}
        allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        webviewDebuggingEnabled={false} sharedCookiesEnabled thirdPartyCookiesEnabled={false}
        allowsInlineMediaPlayback mediaPlaybackRequiresUserAction setSupportMultipleWindows
        onShouldStartLoadWithRequest={request => {
          if (request.isTopFrame === false) return request.url.startsWith('https:') || request.url === 'about:blank';
          if (request.url === 'mailto:sac@jenios.com.br') { contactSupport(); return false; }
          const decision = navigationDecision(request.url);
          if (decision === 'external') external(request.url);
          return decision === 'internal';
        }}
        onOpenWindow={event => {
          const url = event.nativeEvent.targetUrl;
          if(url === 'mailto:sac@jenios.com.br') { contactSupport(); return; }
          if (navigationDecision(url) === 'external') external(url);
          else if (navigationDecision(url) === 'internal') setPage(url);
        }}
        injectedJavaScript={PDF_BRIDGE_SCRIPT}
        injectedJavaScriptForMainFrameOnly
        onMessage={event => {
          if(!active||fileBusy.current)return;
          const value=validatePdfMessage(event.nativeEvent.data,event.nativeEvent.url);
          if(!value)return;
          fileBusy.current=true;
          Alert.alert('Salvar relatório?', value.filename, [
            {text:'Cancelar',style:'cancel',onPress:()=>{fileBusy.current=false;}},
            {text:'Salvar ou compartilhar',onPress:()=>void sharePdf(value)},
          ],{cancelable:true,onDismiss:()=>{fileBusy.current=false;}});
        }}
        onNavigationStateChange={state => { setCanGoBack(state.canGoBack); currentUrl.current=state.url; }}
        onLoadStart={() => { setLoading(true); setFailed(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
        onHttpError={event => { if (event.nativeEvent.statusCode >= 500) { setFailed(true); setLoading(false); } }}
        onContentProcessDidTerminate={() => { setFailed(true); setLoading(false); }}
        onRenderProcessGone={() => { setFailed(true); setLoading(false); }}
      />
      {loading && !failed && <View pointerEvents="none" style={s.loading}><ActivityIndicator color="#bea5ff" /><Text style={s.message}>Abrindo {AREAS[area].title}…</Text></View>}
      {failed && <View style={s.error}><Text accessibilityRole="header" style={s.errorTitle}>Não foi possível carregar</Text><Text style={s.message}>Confira sua conexão e tente novamente.</Text><Pressable accessibilityRole="button" onPress={() => { setFailed(false); setLoading(true); ref.current?.reload(); }} style={s.retry}><Text style={s.retryText}>Tentar novamente</Text></Pressable><Pressable accessibilityRole="button" onPress={onChoose} style={s.touch}><Text style={s.switch}>Voltar às áreas</Text></Pressable></View>}
    </View>
  </SafeAreaView>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: '#0e1120' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, minHeight: 58 }, touch: { padding: 12, minHeight: 44, justifyContent: 'center' }, switch: { color: '#d2bfff', fontWeight: '600', fontSize: 13 }, disabled: { opacity: 0.3 }, title: { color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 }, notice: { padding: 12, color: '#ffe0ac', backgroundColor: '#43351d', fontSize: 13 }, content: { flex: 1 }, webview: { flex: 1, backgroundColor: '#fff' }, loading: { position: 'absolute', top: 0, right: 0, left: 0, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#131726' }, message: { color: '#c0c4d4', fontSize: 14, lineHeight: 22, textAlign: 'center' }, error: { ...StyleSheet.absoluteFill, backgroundColor: '#0e1120', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 28 }, errorTitle: { color: '#fff', fontWeight: '700', fontSize: 22 }, retry: { backgroundColor: '#bba0ff', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 24 }, retryText: { color: '#18102e', fontWeight: '700' } });
