
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
  CpuChipIcon, 
  SignalIcon, 
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  ChevronRightIcon,
  PaperAirplaneIcon,
  CheckIcon,
  CheckBadgeIcon,
  EyeIcon,
  EyeSlashIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  GlobeAltIcon,
  LockClosedIcon,
  BookOpenIcon,
  XMarkIcon,
  BellAlertIcon,
  MicrophoneIcon,
  StopIcon,
  PlayIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/outline';

// --- Dados de Educação Offline (Simulados) ---
const KNOWLEDGE_BASE: KnowledgeArticle[] = [
  { id: '1', title: 'Primeiros Socorros em Crises', category: 'MEDICAL', content: 'Protocolos de triagem e estancamento de hemorragias sem suprimentos hospitalares...', version: 1 },
  { id: '2', title: 'Guia de Segurança Digital', category: 'CIVIC', content: 'Como proteger dispositivos contra apreensão física e análise forense estatal...', version: 1 },
  { id: '3', title: 'Potabilização de Água', category: 'SURVIVAL', content: 'Métodos de filtragem solar e distilação improvisada para cenários de desastre...', version: 1 },
];

export default function App() {
  const [identity, setIdentity] = useState<{ identity: ATLASIdentity; keys: KeyPair } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [setupAlias, setSetupAlias] = useState('');
  const [view, setView] = useState<'CHAT' | 'KNOWLEDGE' | 'MESH'>('CHAT');
  const [peers, setPeers] = useState<ATLASPeer[]>([]);
  const [activePeer, setActivePeer] = useState<ATLASPeer | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showSOSConfirm, setShowSOSConfirm] = useState(false);
  const [hasNewEmergency, setHasNewEmergency] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    MeshService.subscribePeers(setPeers);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (view === 'CHAT') {
      setHasNewEmergency(false);
    }
  }, [messages, view]);

  const playEmergencyTone = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio playback failed", e);
    }
  }, []);

  const handleCreateIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupAlias.trim()) return;
    setIsInitializing(true);
    setTimeout(async () => {
      const id = await CryptoService.generateIdentity(setupAlias);
      setIdentity({ ...id, identity: { ...id.identity, settings: { ...id.identity.settings, stealthMode: false } } });
      setIsInitializing(false);
    }, 1500);
  };

  const handleSendMessage = async (e: React.FormEvent | null, type: ATLASMessageType = ATLASMessageType.CHAT, customText?: string) => {
    e?.preventDefault();
    const textToSend = customText || inputText;
    if (!textToSend.trim() || (!activePeer && type === ATLASMessageType.CHAT) || !identity) return;

    const recipientKey = (type === ATLASMessageType.EMERGENCY || type === ATLASMessageType.KNOWLEDGE_SHARE) 
      ? 'BROADCAST' 
      : activePeer?.publicKey || 'BROADCAST';

    const encrypted = await CryptoService.encrypt(textToSend, recipientKey, identity.keys.privateKey);
    const signature = await CryptoService.sign(encrypted, identity.keys.privateKey);

    const atlasMsg: ATLASMessage = {
      id: Math.random().toString(36).substring(7),
      type,
      senderId: identity.identity.id,
      receiverId: (type === ATLASMessageType.EMERGENCY) ? 'GLOBAL_SOS' : activePeer?.id || 'GLOBAL',
      payload: encrypted,
      signature,
      timestamp: Date.now(),
      hopCount: 0
    };

    await MeshService.broadcast(atlasMsg);
    
    const newMsg: DecryptedMessage = {
      id: atlasMsg.id,
      senderId: identity.identity.id,
      content: textToSend,
      timestamp: atlasMsg.timestamp,
      isMe: true,
      type
    };

    setMessages(prev => [...prev, newMsg]);
    
    if (type === ATLASMessageType.EMERGENCY) {
      setHasNewEmergency(true);
      playEmergencyTone();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
    if (!customText) setInputText('');
  };

  // Voice Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleSendMessage(null, ATLASMessageType.CHAT, `[VOICE_MSG]:${base64Audio}`);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const triggerSOS = () => {
    handleSendMessage(null, ATLASMessageType.EMERGENCY, "ALERTA CRÍTICO: Usuário em perigo imediato. Necessário suporte na localização deste nó!");
    setShowSOSConfirm(false);
    setView('CHAT');
  };

  const toggleStealth = () => {
    if (!identity) return;
    setIdentity({
      ...identity,
      identity: { ...identity.identity, settings: { ...identity.identity.settings, stealthMode: !identity.identity.settings.stealthMode } }
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMessageContent = (content: string) => {
    if (content.startsWith('[VOICE_MSG]:')) {
      const audioUrl = content.replace('[VOICE_MSG]:', '');
      return (
        <div className="flex items-center gap-3 py-1">
          <div className="p-2 bg-white/10 rounded-full cursor-pointer hover:bg-white/20 transition-colors" onClick={() => {
            const audio = new Audio(audioUrl);
            audio.play();
          }}>
            <PlayIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 h-8 flex items-center gap-0.5">
            {[...Array(12)].map((_, i) => (
              <div 
                key={i} 
                className="w-1 bg-white/40 rounded-full animate-pulse" 
                style={{ height: `${20 + Math.random() * 60}%`, animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
          <SpeakerWaveIcon className="w-4 h-4 opacity-50" />
        </div>
      );
    }
    return content;
  };

  if (!identity) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-neutral-100">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-full">
                <GlobeAltIcon className="w-12 h-12 text-emerald-500" />
              </div>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white">ATLAS</h1>
            <p className="text-neutral-400 text-sm leading-relaxed">Infraestrutura para Resiliência Humana, Liberdade Digital e Educação Offline.</p>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800 p-8 rounded-3xl backdrop-blur-xl">
             <form onSubmit={handleCreateIdentity} className="space-y-6">
                <input 
                  type="text" 
                  value={setupAlias}
                  onChange={e => setSetupAlias(e.target.value)}
                  placeholder="Nome de Guerra / Alias"
                  className="w-full bg-black border border-neutral-800 rounded-xl py-4 px-4 outline-none focus:border-emerald-500 transition-all text-neutral-200"
                  required
                />
                <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20">
                  ATIVAR NÓ SOBERANO
                </button>
             </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${identity.identity.settings.stealthMode ? 'bg-[#020202] grayscale' : 'bg-black'} text-neutral-100`}>
      <style>{`
        @keyframes glitch-border {
          0% { border-color: #ef4444; box-shadow: 0 0 5px #ef4444; }
          25% { border-color: #f87171; box-shadow: -2px 0 10px #f87171; }
          50% { border-color: #991b1b; box-shadow: 2px 0 15px #991b1b; }
          75% { border-color: #ef4444; box-shadow: -1px 0 5px #ef4444; }
          100% { border-color: #ef4444; box-shadow: 0 0 5px #ef4444; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px) rotate(-1deg); }
          75% { transform: translateX(4px) rotate(1deg); }
        }
        .glitch-emergency {
          animation: glitch-border 0.2s infinite alternate;
        }
        .shake-container {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>

      {/* SOS Confirmation Overlay */}
      {showSOSConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-sm w-full bg-neutral-900 border border-red-900/50 p-8 rounded-3xl shadow-2xl shadow-red-900/20 text-center">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ExclamationTriangleIcon className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Confirmar SOS?</h2>
            <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
              Isso enviará um alerta de emergência não criptografado para todos os nós na malha mesh num raio de 5km.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={triggerSOS}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-600/20 active:scale-95"
              >
                ENVIAR BROADCAST AGORA
              </button>
              <button 
                onClick={() => setShowSOSConfirm(false)}
                className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 font-bold rounded-2xl transition-all"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de Navegação Crítica */}
      <nav className="w-20 border-r border-neutral-900 flex flex-col items-center py-8 gap-8 bg-neutral-950">
        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
          <GlobeAltIcon className="w-8 h-8 text-white" />
        </div>
        <div className="flex flex-col gap-6 flex-1">
          <button onClick={() => setView('CHAT')} className={`relative p-3 rounded-xl transition-all ${view === 'CHAT' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-600 hover:text-neutral-400'}`}>
            <ChatBubbleLeftRightIcon className="w-7 h-7" />
            {hasNewEmergency && (
              <span className="absolute top-2 right-2 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </button>
          <button onClick={() => setView('KNOWLEDGE')} className={`p-3 rounded-xl transition-all ${view === 'KNOWLEDGE' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-600 hover:text-neutral-400'}`}>
            <AcademicCapIcon className="w-7 h-7" />
          </button>
          <button onClick={() => setView('MESH')} className={`p-3 rounded-xl transition-all ${view === 'MESH' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-600 hover:text-neutral-400'}`}>
            <SignalIcon className="w-7 h-7" />
          </button>
        </div>
        <button onClick={toggleStealth} className={`p-3 rounded-full border ${identity.identity.settings.stealthMode ? 'border-red-500 bg-red-500/10 text-red-500 animate-pulse' : 'border-neutral-800 text-neutral-600'}`}>
          <LockClosedIcon className="w-6 h-6" />
        </button>
      </nav>

      {/* Lista de Contexto */}
      <aside className="w-72 border-r border-neutral-900 bg-neutral-950/50 flex flex-col">
        <div className="p-6 border-b border-neutral-900">
          <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest">{view === 'CHAT' ? 'Mensageiro Mesh' : view === 'KNOWLEDGE' ? 'Biblioteca Offline' : 'Mapa de Rede'}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {view === 'CHAT' && peers.map(peer => (
            <button key={peer.id} onClick={() => setActivePeer(peer)} className={`w-full p-4 flex items-center gap-3 border-l-2 transition-all ${activePeer?.id === peer.id ? 'bg-neutral-900 border-emerald-500' : 'border-transparent hover:bg-neutral-900/30'}`}>
              <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500"><UserCircleIcon className="w-6 h-6" /></div>
              <div className="text-left"><p className="font-bold text-sm text-neutral-200">{peer.alias}</p><p className="text-[10px] text-neutral-600 font-mono">{peer.distance}m via Mesh</p></div>
            </button>
          ))}
          {view === 'KNOWLEDGE' && KNOWLEDGE_BASE.map(art => (
            <button key={art.id} className="w-full p-4 text-left hover:bg-neutral-900/50 border-b border-neutral-900 transition-all">
              <p className="text-[10px] text-emerald-500 font-bold mb-1">{art.category}</p>
              <p className="font-bold text-sm leading-tight">{art.title}</p>
            </button>
          ))}
        </div>
        <div className="p-4 bg-red-950/10 border-t border-red-900/20">
          <button 
            onClick={() => setShowSOSConfirm(true)} 
            className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase tracking-tighter rounded-2xl transition-all shadow-lg shadow-red-600/30 active:scale-[0.97]"
          >
            <ExclamationTriangleIcon className="w-6 h-6" />
            SOS Broadcast
          </button>
        </div>
      </aside>

      {/* Área Principal de Operação */}
      <main className={`flex-1 flex flex-col bg-neutral-950 transition-transform duration-75 ${isShaking ? 'shake-container' : ''}`}>
        {view === 'CHAT' && (activePeer || messages.some(m => m.type === ATLASMessageType.EMERGENCY)) ? (
          <>
            <header className="h-16 border-b border-neutral-900 px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <h3 className="font-bold">{activePeer?.alias || "Global Transmission"}</h3>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-600">
                <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
                CANAL CRIPTOGRAFADO P2P
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.filter(m => 
                m.type === ATLASMessageType.EMERGENCY || 
                (activePeer && (m.senderId === activePeer.id || m.isMe))
              ).map(msg => (
                <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm shadow-sm transition-all duration-500 ${
                    msg.type === ATLASMessageType.EMERGENCY 
                      ? 'bg-red-600/30 border-2 border-red-500 text-red-100 italic animate-[pulse_2s_infinite] glitch-emergency'
                      : msg.isMe ? 'bg-emerald-600 text-white rounded-tr-none min-w-[120px]' : 'bg-neutral-800 text-neutral-200 rounded-tl-none min-w-[120px]'
                  }`}>
                    {msg.type === ATLASMessageType.EMERGENCY && (
                      <div className="flex items-center gap-2 mb-1 not-italic">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 animate-bounce" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-400">ALERTA DE EMERGÊNCIA</span>
                      </div>
                    )}
                    {renderMessageContent(msg.content)}
                    <div className="mt-2 text-[9px] opacity-40 font-mono text-right">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {activePeer && (
              <footer className="p-6">
                <div className="flex items-center gap-2">
                  <form onSubmit={e => handleSendMessage(e)} className="flex-1 flex gap-2 bg-neutral-900 p-1 rounded-2xl border border-neutral-800 overflow-hidden">
                    {isRecording ? (
                      <div className="flex-1 flex items-center px-4 gap-4 animate-pulse">
                         <div className="w-2 h-2 rounded-full bg-red-500"></div>
                         <span className="text-red-500 font-mono text-xs uppercase font-black">Gravando Audio... {formatTime(recordingTime)}</span>
                         <div className="flex-1 flex gap-1 items-center">
                            {[...Array(20)].map((_, i) => (
                              <div key={i} className="w-0.5 bg-red-500/30 h-4" style={{ height: `${20 + Math.random() * 60}%` }} />
                            ))}
                         </div>
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder="Escrever em malha segura..."
                        className="flex-1 bg-transparent px-4 py-3 outline-none text-sm"
                      />
                    )}
                    {inputText.trim() ? (
                      <button className="p-3 bg-emerald-600 rounded-xl text-white"><PaperAirplaneIcon className="w-5 h-5" /></button>
                    ) : (
                      <button 
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording} 
                        className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-emerald-500'}`}
                      >
                        {isRecording ? <StopIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
                      </button>
                    )}
                  </form>
                </div>
              </footer>
            )}
          </>
        ) : view === 'KNOWLEDGE' ? (
          <div className="flex-1 p-12 overflow-y-auto max-w-4xl mx-auto">
            {hasNewEmergency && (
              <div className="mb-6 p-4 bg-red-600/20 border-2 border-red-500/50 rounded-2xl flex items-center justify-between animate-bounce glitch-emergency">
                <div className="flex items-center gap-3">
                  <BellAlertIcon className="w-6 h-6 text-red-500" />
                  <div>
                    <p className="text-sm font-black text-red-100 uppercase tracking-tighter">Novo Alerta de Emergência!</p>
                    <p className="text-xs text-red-200/60 font-mono">Verifique o canal de transmissão global.</p>
                  </div>
                </div>
                <button onClick={() => setView('CHAT')} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl">VER AGORA</button>
              </div>
            )}
            
            <div className="mb-12 border-b border-neutral-800 pb-8">
               <BookOpenIcon className="w-12 h-12 text-emerald-500 mb-4" />
               <h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">Educação e Resiliência</h1>
               <p className="text-neutral-500">Conhecimento distribuído que sobrevive à censura e à queda de infraestrutura elétrica.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {KNOWLEDGE_BASE.map(art => (
                <div key={art.id} className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-emerald-500/50 transition-all group">
                   <h3 className="font-black text-xl mb-3 group-hover:text-emerald-400 transition-colors">{art.title}</h3>
                   <p className="text-neutral-500 text-sm line-clamp-3 leading-relaxed mb-4 font-medium">{art.content}</p>
                   <button className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest border border-emerald-500/30 px-3 py-1 rounded-full">Ler Offline</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
            <GlobeAltIcon className="w-24 h-24 mb-4" />
            <h2 className="text-2xl font-black italic tracking-widest">ATLAS MESHNET</h2>
            <p className="max-w-xs text-sm mt-2 font-mono uppercase tracking-tighter">Aguardando conexão ou selecione um nó ao lado.</p>
          </div>
        )}
      </main>
    </div>
  );
}
