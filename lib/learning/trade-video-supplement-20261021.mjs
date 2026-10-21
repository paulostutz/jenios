/** B266: referências fornecidas em 21/10/2026, SEM transcrição ou metadados verificados.
 * Manter títulos neutros e os links canônicos. A inclusão na Universidade
 * NÃO significa aprovação de estratégias, desempenho ou ordens de corretoras.
 */
export const SUPPLEMENTAL_TRADE_VIDEO_IDS=Object.freeze(["G_nFDmjtlE0", "979p1gqb7M0", "H-idVZ6fEH4", "zh6VEoHaUKg", "xZkDm2duu8c", "Qkc661h1iz4", "1A4tSnC0Uy8", "emNb2doJ3MY", "NjBP6BACVK0", "D534CRqwEC8", "l7LsbjlcnbY", "oHIe8Ypw6EU", "ZdD9qEPRS3Y", "Zx5zLVyzar8", "Ow0IKS7_6RM", "y_h93U8As2E", "grXdvo5ehCc", "QylexXGUXH8", "5P6AXoTz6Xo", "kMTMkFPPNXU", "pPQ6u_f7C0M", "lMWq_bB9lJ4", "xif_QtfAlq8", "6YyShXrcHdo", "WoKoPjm52IQ", "gRKQH64hCck", "-uU0-WUbw-M", "ezJl924G_WM", "Er_RtJhHKD0", "ujxAfklcZ-s", "IXaaNcSYF0w", "Wievh3Si3To", "nBmNiT0Cag4", "Oy5DX6ooums", "htG2a5XLyqk", "W2R3ruueJV8"]);
const ID=/^[A-Za-z0-9_-]{11}$/;
if(SUPPLEMENTAL_TRADE_VIDEO_IDS.length!==36||new Set(SUPPLEMENTAL_TRADE_VIDEO_IDS).size!==36||
   !SUPPLEMENTAL_TRADE_VIDEO_IDS.every(id=>ID.test(id)))throw Error('B266_VIDEO_ID_REGISTRY_INVALID');
export const SUPPLEMENTAL_TRADE_VIDEO_RESOURCES=Object.freeze(SUPPLEMENTAL_TRADE_VIDEO_IDS.map((id,index)=>Object.freeze({
 id,kind:'video',title:`Vídeo enviado para estudo ${String(index+1).padStart(2,'0')}`,
 channel:null,trackId:'biblioteca',verification:'needs_video_review',
 receivedAt:'2026-10-21',source:'user_submitted_youtube_link',
 note:'Link recebido; título, autoria, imagens e legenda ainda não conferidos. Nenhuma regra de trade extraída.',
 researchQuestion:'Obter fontes verificáveis e descrever hipóteses, invalidação, custos e limites de risco antes de qualquer teste.',
 url:`https://www.youtube.com/watch?v=${id}`
})));
