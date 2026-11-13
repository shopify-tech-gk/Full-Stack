import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type Ref,
} from 'react';
import { AppState, Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRouter } from '@/lib/router';
import { todaysVideo } from '@/lib/brand-videos';
import { adUrl, openAdLink, useLiveAds } from '@/lib/ads';
import { font } from '@/theme';

// Same typing workaround as components/LeafletMap.tsx.
const Web = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

const W = 112;
const VIDEO_H = Math.round((W * 16) / 9);
const BAND_H = 30;
const H = VIDEO_H + BAND_H;
const EDGE = 10;

/** YouTube's own embedded player (IFrame API): muted autoplay, inline, looping, no controls. */
function playerHtml(id: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden;height:100%}#p{position:absolute;inset:0;width:100%;height:100%}</style></head>
<body><div id="p"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
var player;
function onYouTubeIframeAPIReady(){
  player=new YT.Player('p',{width:'100%',height:'100%',videoId:${JSON.stringify(id)},
    playerVars:{autoplay:1,mute:1,controls:0,playsinline:1,loop:1,playlist:${JSON.stringify(id)},rel:0,modestbranding:1,fs:0,disablekb:1,iv_load_policy:3},
    events:{
      onReady:function(e){e.target.mute();e.target.playVideo();},
      onStateChange:function(e){if(e.data===0){e.target.seekTo(0);e.target.playVideo();}}
    }});
}
function setMuted(m){if(!player)return;if(m){player.mute();}else{player.unMute();player.setVolume(80);}}
</script></body></html>`;
}

/** v1.19 an advertiser's own uploaded video (HTML5 player): muted autoplay, inline, looping. */
function adVideoHtml(src: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden;height:100%}video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}</style></head>
<body><video id="v" src=${JSON.stringify(src)} autoplay muted loop playsinline webkit-playsinline preload="auto"></video>
<script>
var v=document.getElementById('v');
function setMuted(m){v.muted=m;if(!m){v.volume=0.8;}v.play();}
v.play().catch(function(){});
</script></body></html>`;
}

/**
 * v1.18 Home: today's brand video in a small floating portrait window (bottom corner), playing
 * muted in a loop. Drag it to either side; tap the speaker for sound, "Shop" for the brand's
 * products, X to hide it until the app is opened again. Stops while the home screen isn't showing.
 */
export function BrandVideoPip({ bottom = 14 }: { bottom?: number }) {
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setArea((cur) =>
          cur && cur.width === width && cur.height === height ? cur : { width, height },
        );
      }}
    >
      {area ? <Pip width={area.width} height={area.height} bottom={bottom} /> : null}
    </View>
  );
}

function Pip({ width, height, bottom }: { width: number; height: number; bottom: number }) {
  const router = useRouter();
  const youtube = useMemo(() => todaysVideo(), []);
  // v1.19 a paid video ad takes the window while it's live; YouTube brand videos otherwise.
  const { video: ad } = useLiveAds();
  // Closing hides it only while the app stays open: it's back each time the app is opened or
  // brought back to the front.
  const [closed, setClosed] = useState(false);
  const [focused, setFocused] = useState(true);
  const [muted, setMuted] = useState(true);
  const web = useRef<WebView>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setClosed(false);
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Where it rests: right edge at first; after a drag it snaps to the nearer side.
  const restX = width - W - EDGE;
  const restY = height - bottom - H;
  const pos = useRef(new Animated.ValueXY({ x: restX, y: restY })).current;
  const at = useRef({ x: restX, y: restY });
  const moved = useRef(false);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          moved.current = true;
          pos.setOffset(at.current);
          pos.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_e, g) => {
          pos.flattenOffset();
          const x = at.current.x + g.dx + W / 2 < width / 2 ? EDGE : width - W - EDGE;
          const y = Math.min(Math.max(at.current.y + g.dy, 90), height - bottom - H);
          at.current = { x, y };
          Animated.spring(pos, { toValue: { x, y }, useNativeDriver: false, friction: 7 }).start();
        },
      }),
    [pos, width, height, bottom],
  );

  if ((!ad && !youtube) || closed) return null;

  const toggleSound = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    const next = !muted;
    setMuted(next);
    web.current?.injectJavaScript(`setMuted(${next});true;`);
  };
  const close = () => setClosed(true);
  const shop = () => {
    if (ad) openAdLink(ad);
    else if (youtube) router.push({ pathname: '/search', params: { q: youtube.brand } });
  };
  const label = ad ? ad.advertiserName : (youtube?.brand ?? '');
  const html = ad ? adVideoHtml(adUrl(ad.media[0] ?? '')) : playerHtml(youtube?.youtubeId ?? '');

  return (
    <Animated.View
      style={[styles.card, { transform: pos.getTranslateTransform() }]}
      {...pan.panHandlers}
    >
      <View style={styles.video}>
        {focused ? (
          <Web
            key={ad?.adId ?? youtube?.youtubeId}
            ref={web}
            source={{ html, baseUrl: ad ? adUrl('/') : 'https://youmart.in' }}
            originWhitelist={['*']}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            scrollEnabled={false}
            bounces={false}
            pointerEvents="none"
            style={styles.web}
          />
        ) : null}
        {/* Taps land here (not in the YouTube page): open the brand. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={shop}
          accessibilityLabel={ad ? `Ad from ${label}` : `Shop ${label}`}
        />
        <Pressable style={[styles.round, styles.close]} onPress={close} hitSlop={8}>
          <Ionicons name="close" size={14} color="#ffffff" />
        </Pressable>
        <Pressable style={[styles.round, styles.sound]} onPress={toggleSound} hitSlop={8}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={13} color="#ffffff" />
        </Pressable>
      </View>
      <Pressable style={styles.band} onPress={shop}>
        <Text style={styles.brand} numberOfLines={1} maxFontSizeMultiplier={1}>
          {label}
        </Text>
        {ad ? (
          <View style={styles.adTag}>
            <Text style={styles.adTagText} maxFontSizeMultiplier={1}>
              Ad
            </Text>
          </View>
        ) : (
          <View style={styles.shop}>
            <Text style={styles.shopText} maxFontSizeMultiplier={1}>
              Shop
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: W,
    height: H,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 50,
  },
  video: { width: '100%', height: VIDEO_H, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  round: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { top: 5, right: 5 },
  sound: { bottom: 5, left: 5 },
  band: {
    height: BAND_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    backgroundColor: '#0142aa',
  },
  brand: { flex: 1, fontFamily: font.uiBold, fontSize: 11.5, color: '#ffffff' },
  shop: { backgroundColor: '#ffd60a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  shopText: { fontFamily: font.uiBold, fontSize: 10.5, color: '#1f1300' },
  adTag: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  adTagText: { fontFamily: font.uiBold, fontSize: 10, color: '#ffffff' },
});
