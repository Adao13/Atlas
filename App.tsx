
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ATLASIdentity, 
  KeyPair, 
  ATLASPeer, 
  DecryptedMessage, 
  NodeStatus, 
  ATLASMessage,
  ATLASMessageType,
  KnowledgeArticle
} from './types';
import { CryptoService } from './services/cryptoService';
import { MeshService } from './services/meshService';
import { 
  ShieldCheckIcon, 
  SignalIcon, 
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  GlobeAltIcon,
  LockClosedIcon,
  BookOpenIcon,
  BellAlertIcon,
  MicrophoneIcon,
  StopIcon,
  PlayIcon,
  SpeakerWaveIcon,
  ShieldExclamationIcon,
  CheckBadgeIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  RadioIcon,
  WifiIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

const KNOWLEDGE_BASE: KnowledgeArticle[] = [
  { 
    id: 'med-1', 
    title: 'Protocolo de Trauma e Hemorragia', 
    category: 'MEDICAL', 
    content: '1. Controle de Sangramento: Aplique pressão direta na ferida com pano limpo. Se o sangramento for arterial (pulsante) e em membro, utilize torniquete 5cm acima da ferida. Marque o horário. \n2. Choque: Mantenha a vítima aquecida e com pernas elevadas. \n3. Vias Aéreas: Incline a cabeça e eleve o queixo se não houver suspeita de trauma cervical.', 
    version: 1 
  },
  { 
    id: 'med-2', 
    title: 'Triagem de Vítimas (Método START)', 
    category: 'MEDICAL', 
    content: 'Vermelho (Imediato): Respiração >30bpm ou sem pulso radial. Amarelo (Urgente): Consegue seguir comandos simples. Verde (Leve): Consegue andar. Preto (Expectante): Sem respiração após abertura de vias aéreas.', 
    version: 1 
  },
  { 
    id: 'surv-1', 
    title: 'Construção de Abrigo Básico', 
    category: 'SURVIVAL', 
    content: '1. Localização: Evite vales (inundações) e cumes (raios/vento). \n2. Isolamento: Nunca durma em contato direto com o solo. Crie um estrado de 20cm com galhos e folhas secas. \n3. Estrutura A-Frame: Use um tronco mestre e galhos laterais. Cubra com cascas de árvore ou folhagem sobreposta (estilo telha) para drenar a chuva.', 
    version: 1 
  },
  { 
    id: 'surv-2', 
    title: 'Localização de Fontes de Água', 
    category: 'SURVIVAL', 
    content: '1. Animais: Siga rastros de mamíferos ou voo de pássaros (frequentemente levam à água). \n2. Transpiração: Envolva galhos de árvores verdes com sacos plásticos para coletar condensação. \n3. Orvalho: Colete orvalho da manhã usando panos absorventes na vegetação rasteira. \n4. Purificação: Ferva por 1 min ou use o método SODIS (6h sob sol forte em garrafa PET transparente).', 
    version: 1 
  },
  { 
    id: 'civ-1', 
    title: 'Segurança Digital em Conflito', 
    category: 'CIVIC', 
    content: 'Desative biometria (FaceID/Digital). Use senhas alfanuméricas longas. Em caso de inspeção iminente, utilize o modo Stealth do ATLAS para ocultar logs de comunicação.', 
    version: 1 
  },
];

export default function App() {
  const [identity, setIdentity] = useState<{ identity: ATLASIdentity; keys: KeyPair } | null>(null);
  const [setupAlias, setSetupAlias] = useState('');
  const [view, setView] = useState<'CHAT' | 'KNOWLEDGE' | 'MESH'>('CHAT');
  const [peers, setPeers] = useState<ATLASPeer[]>([]);
  const [activePeer, setActivePeer] = useState<ATLASPeer | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showSOSConfirm, setShowSOSConfirm] = useState(false);
  const [hasNewEmergency, setHasNewEmergency] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [scanPulse, setScanPulse] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    MeshService.subscribePeers((newPeers) => {
      setPeers(newPeers);
      if (view === 'MESH') {
        setScanPulse(true);
        setTimeout(() => setScanPulse(false), 1000);
      }
    });
  }, [view]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (view === 'CHAT') setHasNewEmergency(false);
  }, [messages, view]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      let propagatedAny = false;

      setMessages(currentMessages => {
        let needsUpdate = false;
        const updated = currentMessages.map(msg => {
          if (msg.type === ATLASMessageType.EMERGENCY && msg.emergencyStatus === 'PENDING' && !msg.isMe) {
            const diffMinutes = (now - msg.timestamp) / (1000 * 60);
            
            if (diffMinutes >= 10 && !msg.content.includes('[PROPAGADO]')) {
              propagatedAny = true;
              needsUpdate = true;
              const propagatedContent = `[PROPAGADO VIA LORA/SUB-GHZ]: ${msg.content}`;
              
              if (identity) {
                const atlasMsg: ATLASMessage = {
                  id: `lora_prop_${msg.id}_${now}`,
                  type: ATLASMessageType.EMERGENCY,
                  senderId: identity.identity.id,
                  receiverId: 'GLOBAL_SOS',
                  payload: `LORA_EXPANDED:${propagatedContent}`,
                  signature: `LORA_SIG_${identity.keys.publicKey.substring(0, 8)}`,
                  timestamp: now,
                  hopCount: msg.senderId.includes('prop') ? 2 : 1,
                  emergencyStatus: 'PENDING'
                };
                MeshService.broadcast(atlasMsg);
              }

              return { 
                ...msg, 
                content: propagatedContent,
                timestamp: now
              };
            }
          }
          return msg;
        });
        return needsUpdate ? updated : currentMessages;
      });

      if (propagatedAny) {
        playEmergencyTone();
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 800);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [identity]);

  const playEmergencyTone = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 2);
    } catch (e) { console.warn(e); }
  }, []);

  const handleCreateIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupAlias.trim()) return;
    const id = await CryptoService.generateIdentity(setupAlias);
    setIdentity({ ...id, identity: { ...id.identity, settings: { ...id.identity.settings, stealthMode: false } } });
  };

  const handleSendMessage = async (e: React.FormEvent | null, type: ATLASMessageType = ATLASMessageType.CHAT, customText?: string) => {
    e?.preventDefault();
    const textToSend = customText || inputText;
    if (!textToSend.trim() || (!activePeer && type === ATLASMessageType.CHAT) || !identity) return;

    const atlasMsg: ATLASMessage = {
      id: Math.random().toString(36).substring(7),
      type,
      senderId: identity.identity.id,
      receiverId: (type === ATLASMessageType.EMERGENCY) ? 'GLOBAL_SOS' : activePeer?.id || 'GLOBAL',
      payload: await CryptoService.encrypt(textToSend, 'BROADCAST', identity.keys.privateKey),
      signature: await CryptoService.sign(textToSend, identity.keys.privateKey),
      timestamp: Date.now(),
      hopCount: 0,
      emergencyStatus: type === ATLASMessageType.EMERGENCY ? 'PENDING' : undefined
    };

    await MeshService.broadcast(atlasMsg);
    setMessages(prev => [...prev, {
      id: atlasMsg.id,
      senderId: identity.identity.id,
      content: textToSend,
      timestamp: atlasMsg.timestamp,
      isMe: true,
      type,
      emergencyStatus: atlasMsg.emergencyStatus
    }]);
    
    if (type === ATLASMessageType.EMERGENCY) {
      setHasNewEmergency(true);
      playEmergencyTone();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
    if (!customText) setInputText('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          handleSendMessage(null, ATLASMessageType.CHAT, `[VOICE_MSG]:${reader.result}`);
        };
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resolveEmergency = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, emergencyStatus: 'RESOLVED' } : m));
  };

  const triggerSOS = () => {
    handleSendMessage(null, ATLASMessageType.EMERGENCY, "ALERTA CRÍTICO: Usuário em perigo imediato. Necessário suporte na localização deste nó!");
    setShowSOSConfirm(false);
    setView('CHAT');
  };

  const toggleStealth = () => {
    if (!identity) return;
    setIdentity({ ...identity, identity: { ...identity.identity, settings: { ...identity.identity.settings, stealthMode: !identity.identity.settings.stealthMode } } });
  };

  const renderDistanceIndicator = (distance: number) => {
    let bars = 1;
    if (distance < 1) bars = 4;
    else if (distance < 2) bars = 3;
    else if (distance < 5) bars = 2;

    return (
      <div className="flex items-end gap-0.5 h-3">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i} 
            className={`w-1 rounded-full transition-colors ${i < bars ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-neutral-800'}`} 
            style={{ height: `${(i + 1) * 25}%` }} 
          />
        ))}
      </div>
    );
  };

  if (!identity) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-neutral-100">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-4">
            <GlobeAltIcon className="w-16 h-16 text-emerald-500 mx-auto" />
            <h1 className="text-4xl font-black tracking-tighter uppercase">ATLAS</h1>
            <p className="text-neutral-400 text-sm leading-relaxed">Infraestrutura Descentralizada para Resiliência em Crises.</p>
          </div>
          <form onSubmit={handleCreateIdentity} className="bg-neutral-900/40 border border-neutral-800 p-8 rounded-3xl space-y-6">
            <input type="text" value={setupAlias} onChange={e => setSetupAlias(e.target.value)} placeholder="Identificador (Alias)" className="w-full bg-black border border-neutral-800 rounded-xl py-4 px-4 outline-none focus:border-emerald-500 transition-all" required />
            <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all uppercase tracking-widest text-xs">Ativar Identidade</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${identity.identity.settings.stealthMode ? 'bg-black grayscale' : 'bg-black'} text-neutral-100`}>
      <style>{`
        @keyframes glitch-border { 0% { border-color: #ef4444; box-shadow: 0 0 5px #ef4444; } 50% { border-color: #991b1b; box-shadow: 0 0 15px #991b1b; } 100% { border-color: #ef4444; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        @keyframes sonar { 0% { transform: scale(0.1); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
        @keyframes pulse-ring { 0% { transform: scale(.33); } 80%, 100% { opacity: 0; } }
        .glitch-emergency { animation: glitch-border 0.2s infinite alternate; }
        .shake-container { animation: shake 0.4s both; }
        .sonar-wave { animation: sonar 3s cubic-bezier(0.165, 0.84, 0.44, 1) infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #262626; border-radius: 10px; }
      `}</style>

      {showSOSConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="max-w-sm w-full bg-neutral-900 border border-red-900/50 p-8 rounded-3xl text-center shadow-2xl">
            <ShieldExclamationIcon className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-xl font-black mb-2 uppercase">SOS CRÍTICO</h2>
            <p className="text-neutral-400 text-sm mb-8 leading-relaxed">Confirma ativação do protocolo de emergência?</p>
            <div className="flex flex-col gap-3">
              <button onClick={triggerSOS} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-600/30 uppercase tracking-widest text-xs">Transmitir Alerta</button>
              <button onClick={() => setShowSOSConfirm(false)} className="w-full py-4 bg-neutral-800 text-neutral-400 font-bold rounded-2xl uppercase tracking-widest text-xs">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <nav className="w-20 border-r border-neutral-900 flex flex-col items-center py-8 gap-8 bg-neutral-950">
        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20"><GlobeAltIcon className="w-8 h-8" /></div>
        <div className="flex flex-col gap-6 flex-1">
          <button onClick={() => setView('CHAT')} className={`relative p-3 rounded-xl transition-all ${view === 'CHAT' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-600 hover:text-neutral-400'}`}>
            <ChatBubbleLeftRightIcon className="w-7 h-7" />
            {hasNewEmergency && <span className="absolute top-2 right-2 flex h-3 w-3"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative rounded-full h-3 w-3 bg-red-500"></span></span>}
          </button>
          <button onClick={() => setView('KNOWLEDGE')} className={`p-3 rounded-xl transition-all ${view === 'KNOWLEDGE' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-600 hover:text-neutral-400'}`}><AcademicCapIcon className="w-7 h-7" /></button>
          <button onClick={() => setView('MESH')} className={`p-3 rounded-xl transition-all ${view === 'MESH' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-600 hover:text-neutral-400'}`}><SignalIcon className="w-7 h-7" /></button>
        </div>
        <button onClick={toggleStealth} className={`p-3 rounded-full border transition-all ${identity.identity.settings.stealthMode ? 'border-red-500 animate-pulse text-red-500 bg-red-500/10' : 'border-neutral-800 text-neutral-600'}`}><LockClosedIcon className="w-6 h-6" /></button>
      </nav>

      <aside className="w-72 border-r border-neutral-900 bg-neutral-950 flex flex-col">
        <div className="p-6 border-b border-neutral-900 flex items-center justify-between"><h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest">{view === 'CHAT' ? 'Nós Ativos' : view === 'KNOWLEDGE' ? 'Biblioteca' : 'Radar Mesh'}</h2></div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {(view === 'CHAT' || view === 'MESH') && peers.map(peer => (
            <button key={peer.id} onClick={() => { setActivePeer(peer); setView('CHAT'); }} className={`w-full p-4 flex items-center gap-3 transition-all ${activePeer?.id === peer.id && view === 'CHAT' ? 'bg-neutral-900 border-l-2 border-emerald-500' : 'hover:bg-neutral-900/30 border-l-2 border-transparent'}`}>
              <UserCircleIcon className="w-10 h-10 text-neutral-600" />
              <div className="flex-1 text-left">
                <p className="font-bold text-sm text-neutral-200">{peer.alias}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-neutral-600 font-mono tracking-tighter">{peer.distance}km | {peer.status}</p>
                  {renderDistanceIndicator(peer.distance)}
                </div>
              </div>
            </button>
          ))}
          {view === 'KNOWLEDGE' && KNOWLEDGE_BASE.map(art => (
            <button key={art.id} onClick={() => setSelectedArticle(art)} className={`w-full p-4 text-left border-b border-neutral-900 transition-all ${selectedArticle?.id === art.id ? 'bg-emerald-900/10 border-l-2 border-emerald-500' : 'hover:bg-white/5 border-l-2 border-transparent'}`}>
              <p className="text-[10px] text-emerald-500 font-black mb-1 uppercase tracking-widest">{art.category}</p>
              <p className="font-bold text-sm leading-tight text-neutral-300">{art.title}</p>
            </button>
          ))}
        </div>
        <div className="p-4 bg-red-950/10 border-t border-red-900/10"><button onClick={() => setShowSOSConfirm(true)} className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase rounded-2xl shadow-lg shadow-red-600/30 transition-all"><ExclamationTriangleIcon className="w-5 h-5" /> BROADCAST SOS</button></div>
      </aside>

      <main className={`flex-1 flex flex-col bg-neutral-950 ${isShaking ? 'shake-container' : ''}`}>
        {view === 'CHAT' ? (
          (activePeer || messages.some(m => m.type === ATLASMessageType.EMERGENCY)) ? (
            <>
              <header className="h-16 border-b border-neutral-900 px-6 flex items-center justify-between bg-black/40 backdrop-blur-md z-10">
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-emerald-500/50"></div><h3 className="font-black text-sm uppercase tracking-tighter">{activePeer?.alias || "CANAL DE EMERGÊNCIA"}</h3></div>
                <div className="text-[9px] font-mono text-neutral-600 flex items-center gap-2"><RadioIcon className="w-4 h-4 text-emerald-500" /> TRANSMISSÃO P2P</div>
              </header>
              {/* Mensagens (omitido o corpo completo para focar no novo recurso, mas mantendo a estrutura) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {messages.filter(m => m.type === ATLASMessageType.EMERGENCY || (activePeer && (m.senderId === activePeer.id || m.isMe))).map(msg => (
                  <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.isMe ? 'bg-emerald-600' : 'bg-neutral-800'}`}>
                        {msg.content}
                     </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <footer className="p-6">
                <form onSubmit={e => handleSendMessage(e)} className="flex gap-2 bg-neutral-900 p-1 rounded-2xl border border-neutral-800">
                  <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Mensagem segura..." className="flex-1 bg-transparent px-4 py-3 outline-none text-xs" />
                  <button className="p-3 bg-emerald-600 rounded-xl"><PaperAirplaneIcon className="w-5 h-5" /></button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-neutral-500 p-12 text-center">
              <GlobeAltIcon className="w-24 h-24 mb-6" />
              <h2 className="text-2xl font-black uppercase tracking-tighter">Frequência Silenciosa</h2>
              <p className="max-w-xs text-xs font-mono uppercase mt-4">Nenhum nó selecionado.</p>
            </div>
          )
        ) : view === 'MESH' ? (
          <div className="flex-1 flex flex-col bg-[#050505] relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[500px] h-[500px] flex items-center justify-center">
                <div className="absolute inset-0 border border-emerald-500/20 rounded-full"></div>
                <div className="absolute inset-[100px] border border-emerald-500/10 rounded-full"></div>
                <div className="absolute inset-[200px] border border-emerald-500/5 rounded-full"></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,1)] z-20"></div>
                <div className="absolute inset-0 sonar-wave bg-emerald-500/5 rounded-full z-10"></div>
                
                {peers.map((peer, idx) => {
                  const angle = (idx * 137.5) % 360;
                  const distanceScale = 50 + (peer.distance * 40); 
                  const x = Math.cos(angle) * distanceScale;
                  const y = Math.sin(angle) * distanceScale;

                  return (
                    <div 
                      key={peer.id}
                      className="absolute transition-all duration-1000 flex flex-col items-center group cursor-pointer"
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      onClick={() => { setActivePeer(peer); setView('CHAT'); }}
                    >
                      <div className="relative">
                        <UserCircleIcon className={`w-8 h-8 transition-colors ${peer.status === 'ONLINE' ? 'text-emerald-500' : 'text-neutral-600'}`} />
                        {peer.status === 'ONLINE' && <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full animate-pulse"></span>}
                      </div>
                      <span className="mt-2 text-[9px] font-black uppercase bg-black/80 px-2 py-0.5 rounded border border-neutral-800 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        {peer.alias} ({peer.distance}km)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute bottom-12 left-0 right-0 px-12">
              <div className="max-w-xl mx-auto bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-900/20 rounded-2xl border border-emerald-500/20">
                      <WifiIcon className={`w-6 h-6 text-emerald-500 ${scanPulse ? 'animate-bounce' : ''}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-white">Escaneamento Local</h3>
                      <p className="text-[10px] font-mono text-neutral-500">Discovery Mode: BLE / WiFi-Direct / LoRa</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-black rounded-full border border-neutral-800">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-500">{peers.length} NÓS EM ALCANCE</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-black/40 rounded-2xl border border-neutral-800">
                    <p className="text-[9px] font-black text-neutral-600 uppercase mb-2">Frequência</p>
                    <p className="text-xs font-mono text-neutral-300">2.4GHz ISM / Sub-GHz</p>
                  </div>
                  <div className="p-4 bg-black/40 rounded-2xl border border-neutral-800">
                    <p className="text-[9px] font-black text-neutral-600 uppercase mb-2">Protocolo</p>
                    <p className="text-xs font-mono text-neutral-300">ATLAS-P2P (Encrypted)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-8 md:p-12 overflow-y-auto bg-[#0a0a0a]">
            {/* Biblioteca de Conhecimento (mantida do código anterior) */}
            {selectedArticle ? (
              <div className="max-w-2xl mx-auto space-y-8">
                <button onClick={() => setSelectedArticle(null)} className="text-neutral-500 text-[10px] font-black uppercase">Voltar</button>
                <h1 className="text-4xl font-black text-white uppercase">{selectedArticle.title}</h1>
                <div className="p-8 bg-neutral-900 rounded-[2.5rem] text-neutral-300">
                  {selectedArticle.content}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {KNOWLEDGE_BASE.map(art => (
                  <button key={art.id} onClick={() => setSelectedArticle(art)} className="p-10 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] text-left group">
                    <span className="text-[10px] font-black text-emerald-500 uppercase">{art.category}</span>
                    <h3 className="text-2xl font-black text-white mb-4 uppercase">{art.title}</h3>
                    <p className="text-neutral-500 text-sm line-clamp-2">{art.content}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
