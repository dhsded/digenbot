/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Trash2, 
  Play, 
  Settings2, 
  Image as ImageIcon, 
  Loader2,
  Copy,
  Check,
  FileJson,
  Sparkles,
  RefreshCcw,
  GripVertical,
  User,
  Package
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

type TabMode = 'collection' | 'product';

// --- Types ---

interface SceneImage {
  id: string;
  file: File | null; // null quando selecionado do cofre (já é base64)
  preview: string;
  name: string;
}

interface VaultCharacter {
  id: string;
  name: string;
  images?: string[];     // array de base64 data-URLs
  imageBase64?: string;  // legado: single base64
}

interface GeneratedScene {
  id: string;
  imageName: string;
  duration: string;
  veoPrompt: string;
  digenPrompt: string;
  narration: string;
  description: string;
}

interface ScriptResponse {
  campaignTitle: string;
  scenes: GeneratedScene[];
}

// --- Constants ---

const DURATIONS = ['5s', '6s', '8s', '10s'];
const THEMES = [
  'Roupas Casuais',
  'Coleção de Verão',
  'Noite Elegante',
  'Estilo Streetwear',
  'Moda Fitness / Esportiva',
  'Profissional / Social',
  'Boho Chic',
  'Essenciais Minimalistas'
];



const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

function InjectionDropdown({ scenes, images, modelImage, productImage }: any) {

  const [isOpen, setIsOpen] = useState(false);
  
  if (!scenes || scenes.length === 0) return null;

  const handleInject = async (platform: string) => {
    setIsOpen(false);
    if ((window as any).digenAPI?.injectTask) {
       if ((window as any).digenAPI?.updateLog) {
           (window as any).digenAPI.updateLog(`Preparando sequência de ${scenes.length} tarefas para o Painel Central...`);
       }
       let injectedCount = 0;
       for (let i = 0; i < scenes.length; i++) {
           const scene = scenes[i];
           const imgObj = (images.find((img: any) => img.name === scene.imageName) || 
                       (modelImage?.name === scene.imageName ? modelImage : productImage));
           const prompt = platform === 'flow' ? scene.veoPrompt : scene.digenPrompt;
           
           if(imgObj && imgObj.file) {
               try {
                   if ((window as any).digenAPI?.updateLog) {
                       (window as any).digenAPI.updateLog(`Convertendo imagem ${i+1}/${scenes.length} para injeção...`);
                   }
                   const base64Src = await fileToBase64(imgObj.file);
                   (window as any).digenAPI.injectTask(platform, prompt, base64Src);
               } catch (e) {
                   console.error("Erro ao converter arquivo para base64", e);
               }
           } else if (imgObj && imgObj.preview) {
               // Fallback just in case it's already a data url (not a blob) or we don't have the file
               (window as any).digenAPI.injectTask(platform, prompt, imgObj.preview);
           }
       }
       if ((window as any).digenAPI?.updateLog) {
           (window as any).digenAPI.updateLog(`✅ Sequência de ${scenes.length} tarefas injetada na plataforma ${platform.toUpperCase()} com sucesso!`);
       }
    } else {
       alert('API do Gerador DIGEN não encontrada.');
    }
  };

  return (
    <div className="relative z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all"
      >
        🚀 Injetar Sequência ▾
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <button onClick={() => handleInject('digen')} className="w-full text-left px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors">🧠 Digen</button>
          <button onClick={() => handleInject('flow')} className="w-full text-left px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors">🌊 Flow (Google VEO)</button>
          <button onClick={() => handleInject('meta')} className="w-full text-left px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors">🌐 Meta AI</button>
          <button onClick={() => handleInject('grok')} className="w-full text-left px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors">🌌 Grok (x.ai)</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabMode>('collection');
  
  // Tab 1: Collection
  const [images, setImages] = useState<SceneImage[]>([]);
  const [theme, setTheme] = useState(THEMES[0]);
  const [customTheme, setCustomTheme] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSequencing, setIsSequencing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab 2: Product & Model
  const [modelImage, setModelImage] = useState<SceneImage | null>(null);
  const [productImage, setProductImage] = useState<SceneImage | null>(null);
  const [numScenes, setNumScenes] = useState(3);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  // Shared
  const [observations, setObservations] = useState('');
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<ScriptResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Cofre
  const [vaultCharacters, setVaultCharacters] = useState<VaultCharacter[]>([]);
  const [modelSource, setModelSource] = useState<'file' | 'vault'>('file');
  const [productSource, setProductSource] = useState<'file' | 'vault'>('file');

  // Carrega personagens do cofre via Electron bridge
  useEffect(() => {
    const load = async () => {
      if (typeof window !== 'undefined' && (window as any).digenAPI?.getVault) {
        try {
          const chars = await (window as any).digenAPI.getVault();
          setVaultCharacters(chars || []);
        } catch (e) {
          console.warn('Cofre não disponível:', e);
        }
      }
    };
    load();
  }, []);

  // Theme Sync
  useEffect(() => {
    const loadTheme = async () => {
      if (typeof window !== 'undefined' && (window as any).digenAPI) {
        if ((window as any).digenAPI.getTheme) {
          const t = await (window as any).digenAPI.getTheme();
          if (t === 'dark') document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
        }
        if ((window as any).digenAPI.onThemeChange) {
          (window as any).digenAPI.onThemeChange((t: string) => {
            if (t === 'dark') document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
          });
        }
      }
    };
    loadTheme();
  }, []);

  // --- Handlers ---

  /** Seleciona um personagem do cofre como imagem de modelo ou produto */
  const selectFromVault = (char: VaultCharacter, type: 'model' | 'product') => {
    const imageData = char.images?.[0] || char.imageBase64 || '';
    const sceneImage: SceneImage = {
      id: char.id,
      file: null,
      preview: imageData,
      name: char.name
    };
    if (type === 'model') setModelImage(sceneImage);
    else setProductImage(sceneImage);
  };

  /**
   * Obtém a próxima chave Gemini via ciclagem GLOBAL do main process.
   * O contador é mantido no Electron main e é compartilhado por todas as ferramentas,
   * garantindo um round-robin verdadeiro entre sessões e abas.
   */
  const getGeminiKey = async (): Promise<string | null> => {
    if (typeof window !== 'undefined' && (window as any).digenAPI?.getNextApiKey) {
      const key = await (window as any).digenAPI.getNextApiKey();
      if (key) return key;
    }
    // Fallback para variável de ambiente (desenvolvimento)
    return (import.meta as any).env?.VITE_GEMINI_API_KEY ?? null;
  };

  const autoSequence = async () => {
    if (images.length < 2) return;
    setIsSequencing(true);
    try {
      const key = await getGeminiKey();
      if (!key) throw new Error("Nenhuma chave Gemini configurada. Acesse Configurações no programa principal.");
      const ai = new GoogleGenAI({ apiKey: key });
      const finalTheme = customTheme || theme;

      const imageListData = images.map((img, idx) => ({
        index: idx,
        name: img.name
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analise estas imagens para uma campanha de moda com o tema "${finalTheme}". 
Nomes das imagens: ${JSON.stringify(imageListData)}.
Retorne um array JSON indicando a sequência ideal baseada no nome/descrição das imagens para um fluxo narrativo fluido.
Exemplo: [2, 0, 1].
Retorne APENAS o array JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER }
          }
        }
      });

      const newOrder = JSON.parse(response.text || '[]') as number[];
      if (Array.isArray(newOrder) && newOrder.length === images.length) {
        const sortedImages = newOrder.map(idx => images[idx]);
        setImages(sortedImages);
      }
    } catch (error) {
      console.error("Erro na sequência:", error);
    } finally {
      setIsSequencing(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    addImages(files);
  };

  const handleSingleFileChange = (e: ChangeEvent<HTMLInputElement>, type: 'model' | 'product') => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    const newImage = {
      id: Math.random().toString(36).substr(2, 9),
      file: files[0],
      preview: URL.createObjectURL(files[0]),
      name: files[0].name
    };
    if (type === 'model') setModelImage(newImage);
    else setProductImage(newImage);
  };

  const removeSingleImage = (type: 'model' | 'product') => {
    if (type === 'model' && modelImage) {
      URL.revokeObjectURL(modelImage.preview);
      setModelImage(null);
    } else if (type === 'product' && productImage) {
      URL.revokeObjectURL(productImage.preview);
      setProductImage(null);
    }
  };

  const addImages = (files: File[]) => {
    const newImages = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    addImages(files);
  };

  const handleSortDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleSortDragOver = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const newImages = [...images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setImages(newImages);
  };

  const generateProductScript = async () => {
    if (!modelImage || !productImage) return;
    setIsGenerating(true);
    
    const updateLog = (msg: string) => {
        if ((window as any).digenAPI?.updateLog) {
            (window as any).digenAPI.updateLog(msg);
        }
    };

    updateLog('🔍 Buscando chave de API Gemini ativa no Cofre...');

    try {
      let key = await getGeminiKey();
      if (!key) throw new Error("Nenhuma chave Gemini configurada. Acesse Configurações no programa principal.");
      
      updateLog('🔑 Chave encontrada. Preparando imagens para envio...');
      
      const modelBase64 = await fileToBase64(modelImage.file, modelImage.preview);
      const productBase64 = await fileToBase64(productImage.file, productImage.preview);

      updateLog('🧠 Imagens processadas. Solicitando roteiro inteligente ao Gemini (pode levar alguns segundos)...');
      
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          role: "user",
          parts: [
            { inlineData: { mimeType: getMimeType(modelImage), data: modelBase64.split(',')[1] } },
            { inlineData: { mimeType: getMimeType(productImage), data: productBase64.split(',')[1] } },
            {
              text: `Gere um roteiro narrativo e prompts de animação focados na apresentação de um produto.
Imagens fornecidas (nesta ordem): 1. Modelo/Apresentador(a) (${modelImage.name}), 2. Produto (${productImage.name}).
Duração de cada cena: ${duration}
Número de cenas a gerar: ${numScenes}
Observações específicas: ${observations || "Apresentação comercial e atraente."}

REGRAS OBRIGATÓRIAS:
1. Crie exatamente ${numScenes} cenas detalhando a apresentação do produto pela modelo.
2. O campo 'imageName' deve indicar qual referência usar principalmente na cena (use "${modelImage.name}" se o foco principal do vídeo for a modelo com o produto, ou "${productImage.name}" se for um close-up puro no produto).
3. O NOME DO ARQUIVO REFERENCIADO DEVE ser incluído no INÍCIO dos prompts 'veoPrompt' e 'digenPrompt' entre colchetes.
4. O VEO é excelente para as animações de câmera e ambiente. O DIGEN é para falas. Se a cena não envolver a pessoa, o DIGEN pode focar na dinâmica da cena comercial.
5. As roupas, cenário da modelo e o produto original devem ser mantidos intactos.
6. A narração em PT-BR deve ser persuasiva e alinhada à ação descrita.

Retorne em estrutura JSON:
{
  "campaignTitle": "Nome da Campanha",
  "scenes": [
    { 
      "imageName": "Nome exato do arquivo", 
      "duration": "${duration}", 
      "veoPrompt": "[NOME_DO_ARQUIVO] Prompt em inglês...", 
      "digenPrompt": "[NOME_DO_ARQUIVO] Prompt em inglês...", 
      "narration": "Narração em PT-BR...", 
      "description": "Explicação da cena" 
    }
  ]
}`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              campaignTitle: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    imageName: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    veoPrompt: { type: Type.STRING },
                    digenPrompt: { type: Type.STRING },
                    narration: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["imageName", "duration", "veoPrompt", "digenPrompt", "narration", "description"]
                }
              }
            },
            required: ["campaignTitle", "scenes"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}') as ScriptResponse;
      setGeneratedScript(result);
    } catch (error) {
      console.error("Erro ao gerar roteiro de produto:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateScript = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    if ((window as any).digenAPI?.updateLog) {
      (window as any).digenAPI.updateLog('Iniciando análise de tendências e geração de roteiro via Gemini...');
    }

    try {
      const key = await getGeminiKey();
      if (!key) throw new Error("Nenhuma chave Gemini configurada. Acesse Configurações no programa principal.");
      const ai = new GoogleGenAI({ apiKey: key });
      
      const finalTheme = customTheme || theme;

      const imageParts = await Promise.all(images.map(async (img) => {
        const base64 = await fileToBase64(img.file, img.preview);
        return {
          inlineData: {
            mimeType: getMimeType(img),
            data: base64.split(',')[1]
          }
        };
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          role: "user",
          parts: [
            ...imageParts,
            {
              text: `Gere um roteiro de campanha profissional para loja de roupas baseado nestas imagens. 
Tema: ${finalTheme}
Duração de cada cena: ${duration}
Observações específicas: ${observations || "Seguir estilo padrão de alta costura."}

REGRAS OBRIGATÓRIAS:
1. O NOME ORIGINAL DO ARQUIVO de cada imagem DEVE ser incluído no INÍCIO dos prompts 'veoPrompt' e 'digenPrompt' entre colchetes. Exemplo: "[foto_look_01.jpg] Cinematic camera movement..."
2. As roupas e o CENÁRIO devem ser mantidos idênticos. Não mude cores, tecidos ou o ambiente.
3. Foque em animações cinematográficas para VEO: movimento de câmera (pan, tilt, zoom), partículas de luz, vento sutil no cabelo e expressões faciais.
4. Para DIGEN, foque na naturalidade do modelo digital falando ou reagindo.
5. A narração deve ser em PT-BR, persuasiva e sincronizada com a ação daquela imagem específica.

Retorne em estrutura JSON:
{
  "campaignTitle": "Nome da Campanha",
  "scenes": [
    { 
      "imageName": "Nome exato do arquivo", 
      "duration": "${duration}", 
      "veoPrompt": "[NOME_DO_ARQUIVO] Prompt em inglês...", 
      "digenPrompt": "[NOME_DO_ARQUIVO] Prompt em inglês...", 
      "narration": "Narração em PT-BR...", 
      "description": "Explicação da cena" 
    }
  ]
}`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              campaignTitle: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    imageName: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    veoPrompt: { type: Type.STRING },
                    digenPrompt: { type: Type.STRING },
                    narration: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["imageName", "duration", "veoPrompt", "digenPrompt", "narration", "description"]
                }
              }
            },
            required: ["campaignTitle", "scenes"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}') as ScriptResponse;
      setGeneratedScript(result);
    } catch (error) {
      console.error("Erro ao gerar roteiro:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Converte File → base64 data-URL.
   * Se `file` for null (imagem do cofre), retorna o `preview` que já é uma data-URL.
   */
  const fileToBase64 = (file: File | null, preview?: string): Promise<string> => {
    if (!file) return Promise.resolve(preview || '');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  /** Detecta o mimeType de uma data-URL (ex: "data:image/jpeg;base64,...") */
  const getMimeType = (img: SceneImage): string => {
    if (img.file) return img.file.type;
    const m = img.preview.match(/^data:([^;]+);/);
    return m ? m[1] : 'image/jpeg';
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyScene = (scene: GeneratedScene) => {
    const text = `Scene: ${scene.imageName}\nDuration: ${scene.duration}\nVEO: ${scene.veoPrompt}\nDIGEN: ${scene.digenPrompt}\nNarration: ${scene.narration}`;
    copyText(text);
  };

  const copyToClipboard = () => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(JSON.stringify(generatedScript, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0b] text-gray-900 dark:text-white font-sans selection:bg-orange-500/30">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-orange-500/5 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <main className="relative max-w-[1600px] w-full mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-16">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 text-orange-500"
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-xs font-bold tracking-[0.2em] uppercase text-orange-500">Produção com IA</span>
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-black dark:from-white to-black/40 dark:to-white/40 bg-clip-text text-transparent font-display"
              >
                Gerador de <br /> Propagandas<br/><span className="text-orange-500">TikTok Shop</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-gray-900 dark:text-gray-500 dark:text-white/50 max-w-xl text-lg font-light leading-relaxed"
              >
                Crie roteiros narrativos e prompts de animação para suas coleções de produtos em segundos.
              </motion.p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-500 dark:text-white/40 italic">
                🔑 Chaves gerenciadas nas Configurações
              </div>
            </div>
          </div>
        </header>

        {/* Module Switcher */}
        <div className="flex justify-start mb-12">
          <div className="bg-black/5 dark:bg-white/5 p-1 rounded-2xl flex border border-black/10 dark:border-white/10 overflow-hidden">
            <button 
              onClick={() => setActiveTab('collection')}
              className={`px-8 py-3 rounded-xl transition-all font-bold tracking-widest text-xs uppercase ${activeTab === 'collection' ? 'bg-orange-500 text-gray-900 dark:text-white shadow-lg' : 'text-gray-900 dark:text-gray-500 dark:text-white/40 hover:text-gray-900 dark:text-gray-800 dark:text-white/80'}`}
            >
              Fotos Diversas / Coleção
            </button>
            <button 
              onClick={() => setActiveTab('product')}
              className={`px-8 py-3 rounded-xl transition-all font-bold tracking-widest text-xs uppercase ${activeTab === 'product' ? 'bg-orange-500 text-gray-900 dark:text-white shadow-lg' : 'text-gray-900 dark:text-gray-500 dark:text-white/40 hover:text-gray-900 dark:text-gray-800 dark:text-white/80'}`}
            >
              Apresentador & Produto
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: UI Controls */}
          <div className="lg:col-span-5 space-y-10">
            
            {activeTab === 'collection' ? (
              <>
                {/* Step 1: Upload (Collection) */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-medium flex items-center gap-2">
                      <span className="bg-black/5 dark:bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-sm border border-black/10 dark:border-white/10">1</span>
                      Enviar Fotos
                    </h2>
                    <div className="flex items-center gap-3">
                      {images.length > 1 && (
                        <button 
                          onClick={autoSequence}
                          disabled={isSequencing}
                          className="flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full hover:bg-black/10 dark:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-wider text-orange-400"
                        >
                          {isSequencing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                          Sequência IA
                        </button>
                      )}
                      <span className="text-xs text-gray-900 dark:text-gray-500 dark:text-white/40">{images.length} fotos</span>
                    </div>
                  </div>
                  
                  <div 
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative h-48 border-2 border-dashed border-black/10 dark:border-white/10 rounded-3xl flex flex-col items-center justify-center transition-all hover:border-orange-500/50 hover:bg-black/5 dark:bg-white/5 cursor-pointer"
                  >
                    <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-gray-900 dark:text-gray-500 dark:text-white/40 group-hover:text-orange-500" />
                    </div>
                    <p className="mt-4 text-sm text-gray-900 dark:text-gray-500 dark:text-white/40">Arraste fotos aqui ou clique para buscar</p>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple 
                      accept="image/*"
                      className="hidden" 
                    />
                  </div>

                  {/* Image Grid */}
                  <AnimatePresence>
                    {images.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-3 gap-4"
                      >
                        {images.map((img, index) => (
                          <motion.div
                            key={img.id}
                            layout
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            draggable
                            onDragStart={() => handleSortDragStart(index)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              handleSortDragOver(index);
                            }}
                            onDragEnd={() => setDraggedIndex(null)}
                            className={`group relative aspect-square rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 ${draggedIndex === index ? 'opacity-20' : 'opacity-100'}`}
                          >
                            <img 
                              src={img.preview} 
                              alt={img.name} 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                                className="p-2 bg-red-500/80 rounded-full hover:bg-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-mono">
                              {index + 1}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {images.length > 1 && (
                    <p className="text-[10px] text-gray-900 dark:text-gray-400 dark:text-white/30 text-center italic">Arraste as imagens para reordenar a sequência manual</p>
                  )}
                </section>

                {/* Step 2: Configuration (Collection) */}
                <section className="space-y-6">
                  <h2 className="text-xl font-medium flex items-center gap-2">
                    <span className="bg-black/5 dark:bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-sm border border-black/10 dark:border-white/10">2</span>
                    Configuração
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-xs uppercase tracking-widest text-gray-900 dark:text-gray-500 dark:text-white/40 font-bold flex items-center gap-2">
                        <Sparkles className="w-3 h-3" />
                        Tema da Campanha
                      </label>
                      <select 
                        value={theme}
                        onChange={(e) => { setTheme(e.target.value); setCustomTheme(''); }}
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-black/20 dark:border-white/20 transition-colors appearance-none cursor-pointer"
                      >
                        {THEMES.map(t => <option key={t} value={t} className="bg-[#1a1a1c]">{t}</option>)}
                        <option value="Personalizado" className="bg-[#1a1a1c]">Outro Tema...</option>
                      </select>
                      {theme === 'Personalizado' && (
                        <input 
                          type="text"
                          placeholder="Ex: Coleção Inverno Nordestino"
                          value={customTheme}
                          onChange={(e) => setCustomTheme(e.target.value)}
                          className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-black/20 dark:border-white/20"
                        />
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs uppercase tracking-widest text-gray-900 dark:text-gray-500 dark:text-white/40 font-bold flex items-center gap-2">
                        <Settings2 className="w-3 h-3" />
                        Duração da Cena
                      </label>
                      <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/10 dark:border-white/10">
                        {DURATIONS.map(d => (
                          <button
                            key={d}
                            onClick={() => setDuration(d)}
                            className={`flex-1 py-3 text-sm rounded-xl transition-all ${duration === d ? 'bg-black/10 dark:bg-white/10 text-gray-900 dark:text-white shadow-lg' : 'text-gray-900 dark:text-gray-500 dark:text-white/40 hover:text-gray-900 dark:text-gray-600 dark:text-white/60'}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                {/* Step 1: Upload (Product & Model) */}
                <section className="space-y-6">
                  <h2 className="text-xl font-medium flex items-center gap-2">
                    <span className="bg-black/5 dark:bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-sm border border-black/10 dark:border-white/10">1</span>
                    Imagens de Referência
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* ── Modelo / Apresentador(a) ── */}
                    <div className="space-y-3">
                      <label className="text-xs uppercase tracking-widest text-gray-900 dark:text-gray-500 dark:text-white/40 font-bold flex items-center gap-2">
                        <User className="w-3 h-3" />
                        Modelo / Apresentador(a)
                      </label>

                      {/* Source toggle */}
                      <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-xl border border-black/10 dark:border-white/10">
                        <button
                          onClick={() => { setModelSource('file'); setModelImage(null); }}
                          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                            modelSource === 'file' ? 'bg-orange-500 text-gray-900 dark:text-white' : 'text-gray-900 dark:text-gray-500 dark:text-white/40 hover:text-gray-900 dark:text-gray-700 dark:text-white/70'
                          }`}
                        >📂 Upload</button>
                        <button
                          onClick={() => { setModelSource('vault'); setModelImage(null); }}
                          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                            modelSource === 'vault' ? 'bg-orange-500 text-gray-900 dark:text-white' : 'text-gray-900 dark:text-gray-500 dark:text-white/40 hover:text-gray-900 dark:text-gray-700 dark:text-white/70'
                          }`}
                        >🔒 Cofre</button>
                      </div>

                      {/* Selected preview (both modes) */}
                      {modelImage && (
                        <div className="relative h-32 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 group">
                          <img src={modelImage.preview} alt="Model" className="w-full h-full object-contain p-2 bg-black/40" />
                          <button onClick={(e) => { e.stopPropagation(); if((window as any).digenAPI?.openImageViewer) (window as any).digenAPI.openImageViewer(modelImage.preview); }} className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors z-10 opacity-0 group-hover:opacity-100" title="Dar Zoom"><span className="text-[10px]">🔍</span></button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); if((window as any).digenAPI?.openImageViewer) (window as any).digenAPI.openImageViewer(modelImage.preview); }}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors z-10 opacity-0 group-hover:opacity-100"
                            title="Dar Zoom"
                          >
                            <span className="text-[10px]">🔍</span>
                          </button>
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button onClick={() => setModelImage(null)} className="p-2 bg-red-500/80 rounded-full hover:bg-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="absolute bottom-1 left-2 text-[9px] text-gray-900 dark:text-gray-500 dark:text-white/50 font-mono truncate max-w-[90%]">{modelImage.name}</div>
                        </div>
                      )}

                      {/* File upload zone */}
                      {modelSource === 'file' && !modelImage && (
                        <div
                          onClick={() => modelInputRef.current?.click()}
                          className="h-28 border-2 border-dashed border-black/10 dark:border-white/10 hover:border-orange-500/50 hover:bg-black/5 dark:bg-white/5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all"
                        >
                          <Upload className="w-5 h-5 text-gray-900 dark:text-gray-500 dark:text-white/40 mb-2" />
                          <span className="text-xs text-gray-900 dark:text-gray-500 dark:text-white/40">Clique para selecionar</span>
                          <input type="file" ref={modelInputRef} accept="image/*" className="hidden" onChange={(e) => handleSingleFileChange(e, 'model')} />
                        </div>
                      )}

                      {/* Vault grid */}
                      {modelSource === 'vault' && !modelImage && (
                        vaultCharacters.length === 0 ? (
                          <div className="h-28 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-900 dark:text-gray-400 dark:text-white/30 text-xs text-center px-4">
                            <span className="text-2xl mb-2">🔒</span>
                            Nenhum personagem no cofre.<br/>Adicione pelo Painel Central.
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10">
                            {vaultCharacters.map(char => {
                              const thumb = char.images?.[0] || char.imageBase64 || '';
                              return (
                                <button
                                  key={char.id}
                                  onClick={() => selectFromVault(char, 'model')}
                                  className="group relative aspect-square rounded-xl overflow-hidden border border-black/10 dark:border-white/10 hover:border-orange-500/60 transition-all"
                                  title={char.name}
                                >
                                  {thumb ? (
                                    <img src={thumb} alt={char.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-xl">👤</div>
                                  )}
                                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-center py-0.5 truncate px-1">{char.name}</div>
                                </button>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>

                    {/* ── Produto ── */}
                    <div className="space-y-3">
                      <label className="text-xs uppercase tracking-widest text-gray-900 dark:text-gray-500 dark:text-white/40 font-bold flex items-center gap-2">
                        <Package className="w-3 h-3" />
                        Produto
                      </label>

                      {/* Source toggle */}
                      <div className="flex bg-black/5 dark:bg-white/5 p-0.5 rounded-xl border border-black/10 dark:border-white/10">
                        <button
                          onClick={() => { setProductSource('file'); setProductImage(null); }}
                          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                            productSource === 'file' ? 'bg-blue-500 text-gray-900 dark:text-white' : 'text-gray-900 dark:text-gray-500 dark:text-white/40 hover:text-gray-900 dark:text-gray-700 dark:text-white/70'
                          }`}
                        >📂 Upload</button>
                        <button
                          onClick={() => { setProductSource('vault'); setProductImage(null); }}
                          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                            productSource === 'vault' ? 'bg-blue-500 text-gray-900 dark:text-white' : 'text-gray-900 dark:text-gray-500 dark:text-white/40 hover:text-gray-900 dark:text-gray-700 dark:text-white/70'
                          }`}
                        >🔒 Cofre</button>
                      </div>

                      {/* Selected preview */}
                      {productImage && (
                        <div className="relative h-32 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 group">
                          <img src={productImage.preview} alt="Product" className="w-full h-full object-contain p-2 bg-black/40" />
                          <button onClick={(e) => { e.stopPropagation(); if((window as any).digenAPI?.openImageViewer) (window as any).digenAPI.openImageViewer(productImage.preview); }} className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors z-10 opacity-0 group-hover:opacity-100" title="Dar Zoom"><span className="text-[10px]">🔍</span></button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); if((window as any).digenAPI?.openImageViewer) (window as any).digenAPI.openImageViewer(productImage.preview); }}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors z-10 opacity-0 group-hover:opacity-100"
                            title="Dar Zoom"
                          >
                            <span className="text-[10px]">🔍</span>
                          </button>
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button onClick={() => setProductImage(null)} className="p-2 bg-red-500/80 rounded-full hover:bg-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="absolute bottom-1 left-2 text-[9px] text-gray-900 dark:text-gray-500 dark:text-white/50 font-mono truncate max-w-[90%]">{productImage.name}</div>
                        </div>
                      )}

                      {/* File upload zone */}
                      {productSource === 'file' && !productImage && (
                        <div
                          onClick={() => productInputRef.current?.click()}
                          className="h-28 border-2 border-dashed border-black/10 dark:border-white/10 hover:border-blue-500/50 hover:bg-black/5 dark:bg-white/5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all"
                        >
                          <Upload className="w-5 h-5 text-gray-900 dark:text-gray-500 dark:text-white/40 mb-2" />
                          <span className="text-xs text-gray-900 dark:text-gray-500 dark:text-white/40">Clique para selecionar</span>
                          <input type="file" ref={productInputRef} accept="image/*" className="hidden" onChange={(e) => handleSingleFileChange(e, 'product')} />
                        </div>
                      )}

                      {/* Vault grid */}
                      {productSource === 'vault' && !productImage && (
                        vaultCharacters.length === 0 ? (
                          <div className="h-28 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-900 dark:text-gray-400 dark:text-white/30 text-xs text-center px-4">
                            <span className="text-2xl mb-2">🔒</span>
                            Nenhum personagem no cofre.<br/>Adicione pelo Painel Central.
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10">
                            {vaultCharacters.map(char => {
                              const thumb = char.images?.[0] || char.imageBase64 || '';
                              return (
                                <button
                                  key={char.id}
                                  onClick={() => selectFromVault(char, 'product')}
                                  className="group relative aspect-square rounded-xl overflow-hidden border border-black/10 dark:border-white/10 hover:border-blue-500/60 transition-all"
                                  title={char.name}
                                >
                                  {thumb ? (
                                    <img src={thumb} alt={char.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-xl">📦</div>
                                  )}
                                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-center py-0.5 truncate px-1">{char.name}</div>
                                </button>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>

                  </div>
                </section>

                {/* Step 2: Configuration (Product & Model) */}
                <section className="space-y-6">
                  <h2 className="text-xl font-medium flex items-center gap-2">
                    <span className="bg-black/5 dark:bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-sm border border-black/10 dark:border-white/10">2</span>
                    Configuração
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-xs uppercase tracking-widest text-gray-900 dark:text-gray-500 dark:text-white/40 font-bold flex items-center gap-2">
                        <FileJson className="w-3 h-3" />
                        Número de Cenas
                      </label>
                      <div className="flex bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 items-center px-4 h-12">
                        <input 
                          type="number"
                          min="1"
                          max="15"
                          value={numScenes}
                          onChange={(e) => setNumScenes(Number(e.target.value) || 1)}
                          className="w-full bg-transparent text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs uppercase tracking-widest text-gray-900 dark:text-gray-500 dark:text-white/40 font-bold flex items-center gap-2">
                        <Settings2 className="w-3 h-3" />
                        Duração da Cena
                      </label>
                      <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/10 dark:border-white/10">
                        {DURATIONS.map(d => (
                          <button
                            key={d}
                            onClick={() => setDuration(d)}
                            className={`flex-1 py-2 text-sm rounded-xl transition-all ${duration === d ? 'bg-black/10 dark:bg-white/10 text-gray-900 dark:text-white shadow-lg' : 'text-gray-900 dark:text-gray-500 dark:text-white/40 hover:text-gray-900 dark:text-gray-600 dark:text-white/60'}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Step 3: Observations & Action (Shared) */}
            <section className="space-y-6">
              <div className="space-y-3 pb-8">
                <label className="text-xs uppercase tracking-widest text-gray-900 dark:text-gray-500 dark:text-white/40 font-bold flex items-center gap-2">
                  <GripVertical className="w-3 h-3" />
                  Observações Importantes
                </label>
                <textarea 
                  placeholder="Ex: Foco no público jovem, tom de voz entusiasmado, use gírias atuais, destaque a leveza do tecido..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-black/20 dark:border-white/20 min-h-[100px] resize-none"
                />
              </div>

              {/* Action Button */}
              <button
                disabled={activeTab === 'collection' ? (images.length === 0 || isGenerating) : (!modelImage || !productImage || isGenerating)}
                onClick={activeTab === 'collection' ? generateScript : generateProductScript}
                className={`group relative w-full overflow-hidden rounded-3xl py-6 transition-all font-bold tracking-tight text-lg ${
                  (activeTab === 'collection' ? images.length > 0 : (modelImage && productImage))
                  ? 'bg-white text-black active:scale-[0.98]' : 'bg-black/5 dark:bg-white/5 text-gray-900 dark:text-white/20 cursor-not-allowed'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-white opacity-0 group-hover:opacity-20 transition-opacity" />
                <span className="relative flex items-center justify-center gap-3 font-display">
                  {isGenerating ? (
                    <><Loader2 className="w-6 h-6 animate-spin" /> Gerando Produção...</>
                  ) : (
                    <><Play className="w-5 h-5 fill-current" /> Gerar Roteiro Completo</>
                  )}
                </span>
              </button>
            </section>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {generatedScript ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs uppercase tracking-[0.3em] text-orange-500 font-bold mb-2">Roteiro Gerado</h3>
                      <h2 className="text-3xl font-bold font-display">{generatedScript.campaignTitle}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                      <InjectionDropdown scenes={generatedScript.scenes} images={images} modelImage={modelImage} productImage={productImage} />
                      <button 
                        onClick={copyToClipboard}
                        className="flex items-center gap-2 px-6 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl hover:bg-white hover:text-black transition-all"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span className="text-xs font-bold uppercase tracking-widest">{copied ? 'Copiado' : 'Copiar JSON'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {generatedScript.scenes.map((scene, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="group bg-black/5 dark:bg-white/5 rounded-[2.5rem] p-8 border border-black/10 dark:border-white/10 hover:bg-white/[0.07] transition-colors"
                      >
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                          {/* Image preview in Scene */}
                          <div className="w-full md:w-48 aspect-square rounded-3xl overflow-hidden shadow-2xl bg-black border border-white/5 flex-shrink-0 relative group">
                            {(images.find(img => img.name === scene.imageName) || 
                              (modelImage?.name === scene.imageName ? modelImage : null) || 
                              (productImage?.name === scene.imageName ? productImage : null)) && (
                              <>
                                <img 
                                  src={(images.find(img => img.name === scene.imageName) || 
                                       (modelImage?.name === scene.imageName ? modelImage : productImage))?.preview} 
                                  alt={scene.imageName}
                                  className="w-full h-full object-contain p-2"
                                />
                                
                                <button 
                                  onClick={() => {
                                    const src = (images.find(img => img.name === scene.imageName) || (modelImage?.name === scene.imageName ? modelImage : productImage))?.preview;
                                    if(src && (window as any).digenAPI?.openImageViewer) (window as any).digenAPI.openImageViewer(src);
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors z-10"
                                  title="Dar Zoom"
                                >
                                  <span className="text-[10px]">🔍</span>
                                </button>
                              </>
                            )}
                            {!(images.find(img => img.name === scene.imageName) || 
                               (modelImage?.name === scene.imageName) || 
                               (productImage?.name === scene.imageName)) && (
                              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                                <ImageIcon className="w-8 h-8 text-gray-900 dark:text-white/20 mb-2" />
                                <span className="text-[10px] text-gray-900 dark:text-gray-400 dark:text-white/30 truncate w-full">{scene.imageName}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-xs font-mono font-bold text-gray-900 dark:text-gray-400 dark:text-white/30 uppercase tracking-widest font-display">Cena {i + 1} &bull; {scene.duration}</span>
                                <span className="text-[10px] text-orange-400/60 font-mono mt-1">{scene.imageName}</span>
                              </div>
                              <button 
                                onClick={() => copyScene(scene)}
                                className="p-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/10 dark:bg-white/10 transition-colors"
                                title="Copiar bloco desta cena"
                              >
                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-blue-400 font-display">Prompt VEO (Inglês)</h4>
                                  <button onClick={() => copyText(scene.veoPrompt)} className="text-gray-900 dark:text-white/20 hover:text-blue-400 transition-colors">
                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                <p className="text-sm text-gray-900 dark:text-gray-800 dark:text-white/80 leading-relaxed italic bg-black/20 p-4 rounded-2xl border border-white/5">
                                  "{scene.veoPrompt}"
                                </p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-purple-400 font-display">Prompt DIGEN (Inglês)</h4>
                                  <button onClick={() => copyText(scene.digenPrompt)} className="text-gray-900 dark:text-white/20 hover:text-purple-400 transition-colors">
                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                <p className="text-sm text-gray-900 dark:text-gray-800 dark:text-white/80 leading-relaxed italic bg-black/20 p-4 rounded-2xl border border-white/5">
                                  "{scene.digenPrompt}"
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2 bg-orange-500/5 p-6 rounded-3xl border border-orange-500/10">
                              <div className="flex items-center justify-between">
                                <h4 className="text-[10px] uppercase font-bold tracking-widest text-orange-500 font-display">Narração / Diálogo (PT-BR)</h4>
                                <button onClick={() => copyText(scene.narration)} className="text-gray-900 dark:text-white/20 hover:text-orange-500 transition-colors">
                                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                              <p className="text-lg font-medium text-gray-900 dark:text-white/90">
                                {scene.narration}
                              </p>
                              <p className="text-xs text-gray-900 dark:text-gray-500 dark:text-white/40 mt-3 pt-3 border-t border-white/5">
                                <strong>Contexto:</strong> {scene.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <button 
                    onClick={() => {
                      if(confirm("Deseja iniciar um novo projeto? Todas as configurações e roteiros atuais serão perdidos.")) {
                        setGeneratedScript(null);
                        setImages([]);
                        setModelImage(null);
                        setProductImage(null);
                        setObservations('');
                      }
                    }}
                    className="w-full py-6 text-gray-900 dark:text-gray-500 dark:text-white/40 hover:text-gray-900 dark:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCcw className="w-4 h-4" /> Iniciar Novo Projeto
                  </button>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-20 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full" />
                    <div className="relative bg-black/5 dark:bg-white/5 w-24 h-24 rounded-full flex items-center justify-center border border-black/10 dark:border-white/10">
                      <FileJson className="w-10 h-10 text-gray-900 dark:text-gray-500 dark:text-white/40" />
                    </div>
                  </div>
                  <div className="max-w-xs px-6">
                    <h3 className="text-xl font-medium mb-2 font-display">Nenhum Roteiro Gerado</h3>
                    <p className="text-sm text-gray-900 dark:text-gray-400 dark:text-white/30 font-light leading-relaxed">
                      Envie as fotos dos seus looks e defina um tema para criar prompts cinematográficos e narrações persuasivas.
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

