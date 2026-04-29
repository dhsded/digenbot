import { GoogleGenAI, Type } from "@google/genai";
import { useState, useRef, ChangeEvent, useEffect } from "react";
import { Copy, Sparkles, Wand2, BookOpen, Clock, Clapperboard, Image as ImageIcon, Video, ChevronRight, Users, UserCircle, Upload, X, Camera, Type as TypeIcon, Key, Package } from "lucide-react";

declare global {
  interface Window {
    digenAPI: any;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'script' | 'character' | 'camera'>('script');

  // API Keys State (Global)
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [currentKeyIndex, setCurrentKeyIndex] = useState(0);

  // Vault Modal State
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [vaultCharacters, setVaultCharacters] = useState<any[]>([]);

  useEffect(() => {
    if (window.digenAPI && window.digenAPI.getApiKeys) {
      window.digenAPI.getApiKeys().then((keys: string[]) => {
        if (keys && keys.length > 0) {
          setApiKeys(keys);
        }
      });
    }
  }, []);

  // Script Generator State
  const [theme, setTheme] = useState("");
  const [numCharacters, setNumCharacters] = useState(2);
  const [referenceCharacters, setReferenceCharacters] = useState("");
  const [scriptImages, setScriptImages] = useState<string[]>([]);
  const [numScenes, setNumScenes] = useState(3);
  const [duration, setDuration] = useState("5s");
  const [videoAI, setVideoAI] = useState("VEO3");
  const [previousScript, setPreviousScript] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [error, setError] = useState("");
  const scriptFileInputRef = useRef<HTMLInputElement>(null);

  // Character Creator State
  const [characterDescription, setCharacterDescription] = useState("");
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [generatedCharacter, setGeneratedCharacter] = useState<any>(null);
  const [characterError, setCharacterError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera Generator State
  const [cameraSubject, setCameraSubject] = useState("");
  const [cameraText, setCameraText] = useState("");
  const [cameraImage, setCameraImage] = useState<string | null>(null);
  const [numAngles, setNumAngles] = useState(5);
  const [isGeneratingCamera, setIsGeneratingCamera] = useState(false);
  const [generatedCameras, setGeneratedCameras] = useState<any>(null);
  const [cameraError, setCameraError] = useState("");
  const cameraFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCharacterImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setCharacterImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCameraImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeCameraImage = () => {
    setCameraImage(null);
    if (cameraFileInputRef.current) {
      cameraFileInputRef.current.value = '';
    }
  };

  const handleScriptImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScriptImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (scriptFileInputRef.current) {
      scriptFileInputRef.current.value = '';
    }
  };

  const removeScriptImage = (index: number) => {
    setScriptImages(prev => prev.filter((_, i) => i !== index));
  };

  // Removed local API keys upload logic

  const generateWithRetry = async (contents: any, schema: any) => {
    if (apiKeys.length === 0) {
      throw new Error("Nenhuma chave de API configurada.");
    }

    let attempts = 0;
    const maxAttempts = apiKeys.length;
    let indexToUse = currentKeyIndex;

    while (attempts < maxAttempts) {
      try {
        const currentKey = apiKeys[indexToUse];
        const aiInstance = new GoogleGenAI({ apiKey: currentKey });
        
        const response = await aiInstance.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema
          }
        });
        
        if (indexToUse !== currentKeyIndex) {
          setCurrentKeyIndex(indexToUse);
        }
        return response;
      } catch (error: any) {
        console.error(`Erro com a chave no índice ${indexToUse}:`, error);
        const errorMsg = (error?.message || '').toLowerCase();
        const statusCode = error?.status || error?.code || 0;
        
        const shouldRotateKey = 
            statusCode === 429 || statusCode === 400 || statusCode === 401 || statusCode === 403 || 
            errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('exhausted') || 
            errorMsg.includes('api key not valid') || errorMsg.includes('api key expired') || errorMsg.includes('expired');
        
        if (shouldRotateKey && apiKeys.length > 1) {
          console.log(`Chave falhou (índice ${indexToUse}) - Status: ${statusCode}. Tentando a próxima...`);
          indexToUse = (indexToUse + 1) % apiKeys.length;
          attempts++;
        } else {
          throw error;
        }
      }
    }
    throw new Error("Todas as chaves da API foram esgotadas. Tente novamente mais tarde.");
  };

  const handleGenerateCharacter = async () => {
    if (!characterDescription && !characterImage) {
      setCharacterError("Por favor, insira uma descrição ou envie uma imagem de referência.");
      return;
    }
    
    setIsGeneratingCharacter(true);
    setCharacterError("");
    setGeneratedCharacter(null);

    try {
      const prompt = `
        Crie um perfil de personagem de novela viral (animal antropomórfico) com base na imagem de referência e/ou descrição fornecida.
        
        ${characterDescription ? `Descrição: ${characterDescription}` : "Descrição: (Use a imagem de referência para deduzir os detalhes visuais e criar uma personalidade que combine)."}
        
        Forneça:
        1. Nome do personagem.
        2. Espécie do animal.
        3. Personalidade e papel na novela.
        4. Um prompt de imagem em inglês, altamente detalhado, otimizado para o gerador "Nano Banana 2" (estilo Midjourney/fotorealista/cinematográfico).
      `;

      const contents: any[] = [prompt];
      
      if (characterImage) {
        const mimeType = characterImage.split(';')[0].split(':')[1];
        const base64Data = characterImage.split(',')[1];
        contents.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      }

      const response = await generateWithRetry(contents, {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nome do personagem" },
          species: { type: Type.STRING, description: "Espécie do animal" },
          personality: { type: Type.STRING, description: "Personalidade e papel na novela" },
          imagePrompt: { type: Type.STRING, description: "Prompt de imagem em inglês para Nano Banana 2" },
        },
        required: ["name", "species", "personality", "imagePrompt"]
      });

      if (response.text) {
        setGeneratedCharacter(JSON.parse(response.text));
      }
    } catch (err: any) {
      console.error(err);
      setCharacterError(err.message || "Ocorreu um erro ao gerar o personagem. Tente novamente.");
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const handleGenerate = async () => {
    if (!theme) {
      setError("Por favor, insira um tema para a história.");
      return;
    }
    
    setIsGenerating(true);
    setError("");
    setGeneratedData(null);

    try {
      const prompt = `
        Crie um roteiro de novela viral focado em animais antropomórficos.
        
        Tema/Sinopse: ${theme}
        Número de personagens principais: ${numCharacters}
        ${referenceCharacters ? `Personagens de Referência (use-os na história):\n${referenceCharacters}` : ""}
        Número de cenas: ${numScenes}
        Duração de cada cena: ${duration}
        I.A. de Vídeo Alvo: ${videoAI}
        ${previousScript ? `Roteiro Anterior (para dar continuidade):\n${previousScript}` : ""}
        ${scriptImages.length > 0 ? "Imagens de referência dos personagens foram fornecidas em anexo. Extraia as características visuais delas para manter a consistência absoluta nos prompts de imagem e vídeo." : ""}
        
        REGRAS IMPORTANTES:
        1. A história DEVE refletir uma forte proximidade com o cotidiano e a cultura brasileira (ex: costumes, expressões, ambientes típicos do Brasil, drama de novela brasileira).
        2. Cada cena DEVE possuir narração ou diálogo explícito.
        
        Para cada cena, forneça:
        1. Ação, Narração e Diálogos da cena.
        2. Um prompt de imagem em inglês, altamente detalhado, otimizado para o gerador "Nano Banana" (estilo Midjourney/fotorealista/cinematográfico).
        3. Um prompt de vídeo em inglês, otimizado para ${videoAI}, especificando movimento de câmera, iluminação, e a duração de ${duration}.
      `;

      const contents: any[] = [prompt];
      
      scriptImages.forEach(img => {
        const mimeType = img.split(';')[0].split(':')[1];
        const base64Data = img.split(',')[1];
        contents.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      });

      const response = await generateWithRetry(contents, {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Título do capítulo da novela",
          },
          synopsis: {
            type: Type.STRING,
            description: "Breve sinopse deste capítulo",
          },
          fullStoryText: {
            type: Type.STRING,
            description: "A história completa em formato de texto corrido (conto/narrativa), detalhando a trama.",
          },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sceneNumber: { type: Type.INTEGER },
                setting: { type: Type.STRING, description: "Cenário da cena" },
                actionAndDialogue: { type: Type.STRING, description: "Ação, narração e diálogos detalhados em português" },
                imagePrompt: { type: Type.STRING, description: "Prompt de imagem em inglês para Nano Banana" },
                videoPrompt: { type: Type.STRING, description: "Prompt de vídeo em inglês para a IA escolhida" },
              },
              required: ["sceneNumber", "setting", "actionAndDialogue", "imagePrompt", "videoPrompt"]
            }
          }
        },
        required: ["title", "synopsis", "fullStoryText", "scenes"]
      });

      if (response.text) {
        setGeneratedData(JSON.parse(response.text));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro ao gerar o roteiro. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCameras = async () => {
    if (!cameraSubject && !cameraImage) {
      setCameraError("Por favor, descreva a cena/personagem ou envie uma imagem de referência.");
      return;
    }
    
    setIsGeneratingCamera(true);
    setCameraError("");
    setGeneratedCameras(null);

    try {
      const prompt = `
        Crie um conjunto de prompts de geração de imagem para a EXATA MESMA CENA/PERSONAGEM, mas vistos de diferentes ângulos de câmera e distâncias (ex: Extreme Close-up, Medium Shot, Full Body Wide Shot, Low Angle, High Angle, Over-the-shoulder).
        
        ${cameraSubject ? `Descrição da Cena/Personagem: ${cameraSubject}` : "Descrição da Cena/Personagem: (Baseie-se inteiramente na imagem de referência fornecida)."}
        ${cameraText ? `Texto que deve aparecer escrito no cenário: "${cameraText}"` : ""}
        
        REGRAS IMPORTANTES:
        1. Os prompts gerados DEVEM estar em INGLÊS.
        2. Os prompts devem ser altamente detalhados, estilo fotorealista e cinematográfico.
        3. Se houver "Texto no cenário", você DEVE incluí-lo no prompt em inglês exatamente como solicitado (ex: with a sign that reads "TEXTO AQUI"), mantendo o texto em si em português.
        4. Gere exatamente ${numAngles} ângulos diferentes.
      `;

      const contents: any[] = [prompt];
      
      if (cameraImage) {
        const mimeType = cameraImage.split(';')[0].split(':')[1];
        const base64Data = cameraImage.split(',')[1];
        contents.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      }

      const response = await generateWithRetry(contents, {
        type: Type.OBJECT,
        properties: {
          angles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                angleName: { type: Type.STRING, description: "Nome do ângulo em português (ex: Close-up, Plano Aberto)" },
                prompt: { type: Type.STRING, description: "English image generation prompt" }
              },
              required: ["angleName", "prompt"]
            }
          }
        },
        required: ["angles"]
      });

      if (response.text) {
        setGeneratedCameras(JSON.parse(response.text));
      }
    } catch (err: any) {
      console.error(err);
      setCameraError(err.message || "Ocorreu um erro ao gerar as câmeras. Tente novamente.");
    } finally {
      setIsGeneratingCamera(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleEditMain = (field: string, value: string) => {
    if (generatedData) {
      setGeneratedData({ ...generatedData, [field]: value });
    }
  };

  const handleEditScene = (index: number, field: string, value: string) => {
    if (generatedData) {
      const newData = { ...generatedData };
      newData.scenes[index][field] = value;
      setGeneratedData(newData);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col md:flex-row selection:bg-indigo-500/30">
      {/* Left Panel - Controls */}
      <div className="w-full md:w-[400px] lg:w-[450px] bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="p-8 border-b border-slate-800">
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Novelas</span>
            <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-pink-400">Virais</span>
          </h1>
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em] font-semibold">
            Gerador de Prompts
          </p>
        </div>

        <div className="p-8 flex-1 flex flex-col gap-6">
          {/* Tabs */}
          <div className="flex gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button 
              onClick={() => setActiveTab('script')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === 'script' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              Roteiro
            </button>
            <button 
              onClick={() => setActiveTab('character')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === 'character' ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/25' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              Personagens
            </button>
            <button 
              onClick={() => setActiveTab('camera')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${activeTab === 'camera' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              Câmeras
            </button>
          </div>

          {activeTab === 'script' ? (
            <>
              {/* Theme */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Tema / Sinopse
                </label>
                <textarea 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Ex: Um romance proibido entre um lobo mafioso e uma coelha detetive..."
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm text-slate-200 placeholder:text-slate-600 transition-all resize-none h-28"
                />
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <Clapperboard className="w-4 h-4 text-indigo-400" />
                    Cenas
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10"
                    value={numScenes}
                    onChange={(e) => setNumScenes(parseInt(e.target.value) || 1)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm text-slate-200"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Personagens
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="20"
                    value={numCharacters}
                    onChange={(e) => setNumCharacters(parseInt(e.target.value) || 1)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm text-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    Duração
                  </label>
                  <select 
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm text-slate-200 appearance-none"
                  >
                    <option value="5s">5 Segundos</option>
                    <option value="8s">8 Segundos</option>
                    <option value="10s">10 Segundos</option>
                    <option value="15s">15 Segundos</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <Video className="w-4 h-4 text-indigo-400" />
                    I.A. de Vídeo
                  </label>
                  <div className="flex gap-2">
                    {['VEO3', 'DIGEN'].map((ai) => (
                      <button
                        key={ai}
                        onClick={() => setVideoAI(ai)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${
                          videoAI === ai 
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 border-cyan-400' 
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {ai}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reference Characters */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <UserCircle className="w-4 h-4 text-indigo-400" />
                    Personagens de Referência (Opcional)
                  </label>
                  <textarea 
                    value={referenceCharacters}
                    onChange={(e) => setReferenceCharacters(e.target.value)}
                    placeholder="Ex: Roberto (Lobo guará, detetive), Carmem (Onça pintada, cantora)..."
                    className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm text-slate-200 placeholder:text-slate-600 transition-all resize-none h-24"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                      <ImageIcon className="w-4 h-4 text-indigo-400" />
                      Imagens de Referência
                    </label>
                    <button 
                      onClick={async () => {
                        if (window.digenAPI && window.digenAPI.getVault) {
                          const characters = await window.digenAPI.getVault();
                          if (characters && characters.length > 0) {
                            setVaultCharacters(characters);
                            setShowVaultModal(true);
                          } else {
                            alert('Nenhum personagem encontrado no cofre.');
                          }
                        } else {
                          alert('Cofre não disponível.');
                        }
                      }}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Package className="w-4 h-4" />
                      Abrir Cofre
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {scriptImages.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 shadow-md shrink-0">
                        <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeScriptImage(idx)} 
                          className="absolute top-1 right-1 p-1 bg-black/60 backdrop-blur-sm rounded-full text-white hover:bg-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div 
                      onClick={() => scriptFileInputRef.current?.click()}
                      className="w-20 h-20 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-slate-800/50 transition-all shrink-0"
                      title="Adicionar imagem"
                    >
                      <Upload className="w-5 h-5 text-slate-400 mb-1" />
                    </div>
                  </div>
                  <input 
                    type="file" 
                    multiple
                    ref={scriptFileInputRef} 
                    onChange={handleScriptImageUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              </div>

              {/* Previous Script */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  Roteiro Anterior (Opcional)
                </label>
                <textarea 
                  value={previousScript}
                  onChange={(e) => setPreviousScript(e.target.value)}
                  placeholder="Cole aqui o roteiro do capítulo anterior para dar continuidade à história..."
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm text-slate-200 placeholder:text-slate-600 transition-all resize-none h-32"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 text-red-400 rounded-2xl text-sm border border-red-500/20">
                  {error}
                </div>
              )}

              <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mt-auto w-full py-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-2xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-indigo-400 hover:to-cyan-400 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gerando Roteiro...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Gerar Capítulo
                  </>
                )}
              </button>
            </>
          ) : activeTab === 'character' ? (
            <>
              {/* Character Creator Tab */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <ImageIcon className="w-4 h-4 text-fuchsia-400" />
                  Imagem de Referência (Opcional)
                </label>
                
                {characterImage ? (
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-700 shadow-lg">
                    <img src={characterImage} alt="Referência" className="w-full h-full object-cover" />
                    <button 
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-fuchsia-500 hover:bg-slate-800/50 transition-all"
                  >
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-sm font-medium text-slate-400">Clique para enviar imagem</span>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <UserCircle className="w-4 h-4 text-fuchsia-400" />
                  Descrição do Personagem
                </label>
                <textarea 
                  value={characterDescription}
                  onChange={(e) => setCharacterDescription(e.target.value)}
                  placeholder="Ex: Uma raposa fêmea elegante, usa roupas de época vitoriana, tem uma cicatriz no olho esquerdo. Ela é a vilã da história."
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500 text-sm text-slate-200 placeholder:text-slate-600 transition-all resize-none h-40"
                />
              </div>

              {characterError && (
                <div className="p-4 bg-red-500/10 text-red-400 rounded-2xl text-sm border border-red-500/20">
                  {characterError}
                </div>
              )}

              <button 
                onClick={handleGenerateCharacter}
                disabled={isGeneratingCharacter}
                className="mt-auto w-full py-4 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white rounded-2xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-fuchsia-400 hover:to-pink-400 transition-all shadow-lg shadow-fuchsia-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingCharacter ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando Personagem...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Gerar Personagem
                  </>
                )}
              </button>
            </>
          ) : activeTab === 'camera' ? (
            <>
              {/* Camera Creator Tab */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  Imagem de Referência (Opcional)
                </label>
                
                {cameraImage ? (
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-700 shadow-lg">
                    <img src={cameraImage} alt="Referência" className="w-full h-full object-cover" />
                    <button 
                      onClick={removeCameraImage}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => cameraFileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-500 hover:bg-slate-800/50 transition-all"
                  >
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-sm font-medium text-slate-400">Clique para enviar imagem</span>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={cameraFileInputRef} 
                  onChange={handleCameraImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Camera className="w-4 h-4 text-amber-400" />
                  Descrição da Cena / Personagem
                </label>
                <textarea 
                  value={cameraSubject}
                  onChange={(e) => setCameraSubject(e.target.value)}
                  placeholder="Ex: Um lobo detetive vestindo um sobretudo marrom, fumando um charuto em um beco escuro e chuvoso..."
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm text-slate-200 placeholder:text-slate-600 transition-all resize-none h-40"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <TypeIcon className="w-4 h-4 text-amber-400" />
                  Texto no Cenário (Opcional)
                </label>
                <input 
                  type="text"
                  value={cameraText}
                  onChange={(e) => setCameraText(e.target.value)}
                  placeholder="Ex: BAR DO ZÉ (Será mantido em PT-BR)"
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm text-slate-200 placeholder:text-slate-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Camera className="w-4 h-4 text-amber-400" />
                  Número de Ângulos
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="10"
                  value={numAngles}
                  onChange={(e) => setNumAngles(parseInt(e.target.value) || 1)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm text-slate-200"
                />
              </div>

              {cameraError && (
                <div className="p-4 bg-red-500/10 text-red-400 rounded-2xl text-sm border border-red-500/20">
                  {cameraError}
                </div>
              )}

              <button 
                onClick={handleGenerateCameras}
                disabled={isGeneratingCamera}
                className="mt-auto w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingCamera ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gerando Câmeras...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Gerar Ângulos
                  </>
                )}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex-1 p-8 md:p-12 lg:p-16 overflow-y-auto bg-slate-950">
        {activeTab === 'script' ? (
          <>
            {!generatedData && !isGenerating && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-50">
                <div className="w-24 h-24 border border-slate-700 rounded-full flex items-center justify-center mb-6 bg-slate-900">
                  <Sparkles className="w-10 h-10 text-indigo-400" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-2 text-white">Aguardando Inspiração</h2>
                <p className="text-sm text-slate-400">Preencha os detalhes ao lado e clique em gerar para criar o próximo capítulo da sua novela viral.</p>
              </div>
            )}

            {isGenerating && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-24 h-24 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-6" />
                <h2 className="font-display text-2xl font-bold mb-2 text-white animate-pulse">Escrevendo o Roteiro...</h2>
                <p className="text-sm text-slate-400">A inteligência artificial está elaborando os dramas, cenários e prompts de geração.</p>
              </div>
            )}

            {generatedData && !isGenerating && (
              <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="mb-12 text-center">
                  <input 
                    value={generatedData.title}
                    onChange={(e) => handleEditMain('title', e.target.value)}
                    className="font-display text-4xl md:text-5xl font-extrabold mb-4 text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none text-center w-full transition-colors"
                  />
                  <textarea 
                    value={generatedData.synopsis}
                    onChange={(e) => handleEditMain('synopsis', e.target.value)}
                    className="text-lg text-indigo-300 font-medium max-w-2xl mx-auto mb-8 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none text-center w-full resize-none transition-colors"
                    rows={2}
                  />
                  
                  {/* Export Buttons */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <button 
                      onClick={() => copyToClipboard(generatedData.fullStoryText)} 
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors flex items-center gap-2"
                      title="Copiar apenas a história em texto"
                    >
                      <BookOpen className="w-4 h-4" /> História
                    </button>
                    <button 
                      onClick={() => copyToClipboard(generatedData.scenes.map((s: any) => `Cena ${s.sceneNumber}:\n${s.imagePrompt}`).join('\n\n'))} 
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors flex items-center gap-2"
                      title="Copiar apenas os prompts de imagem"
                    >
                      <ImageIcon className="w-4 h-4" /> Prompts Imagem
                    </button>
                    <button 
                      onClick={() => copyToClipboard(generatedData.scenes.map((s: any) => `Cena ${s.sceneNumber}:\n${s.videoPrompt} Speech (PT-BR): "${s.actionAndDialogue}"`).join('\n\n---\n\n'))} 
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors flex items-center gap-2"
                      title="Copiar prompts de vídeo com diálogos"
                    >
                      <Video className="w-4 h-4" /> Prompts Vídeo
                    </button>
                    <button 
                      onClick={() => copyToClipboard(generatedData.scenes.map((s: any) => `Cena ${s.sceneNumber}\nImage Prompt:\n${s.imagePrompt}\n\nVideo Prompt:\n${s.videoPrompt} Speech (PT-BR): "${s.actionAndDialogue}"`).join('\n\n---\n\n'))} 
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors flex items-center gap-2"
                      title="Copiar todos os prompts e diálogos juntos"
                    >
                      <Sparkles className="w-4 h-4" /> Todos Prompts
                    </button>
                    <button 
                      onClick={() => copyToClipboard(`TÍTULO: ${generatedData.title}\n\nHISTÓRIA:\n${generatedData.fullStoryText}\n\nPROMPTS:\n${generatedData.scenes.map((s: any) => `CENA ${s.sceneNumber}\nImage:\n${s.imagePrompt}\n\nVideo:\n${s.videoPrompt} Speech (PT-BR): "${s.actionAndDialogue}"`).join('\n\n---\n\n')}`)} 
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-xs font-bold uppercase tracking-wider text-white transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                      title="Copiar história e todos os prompts"
                    >
                      <Copy className="w-4 h-4" /> Extrair Tudo
                    </button>
                  </div>
                </div>

                {/* Full Story Text */}
                <div className="bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-800 mb-12">
                  <h3 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-indigo-400" /> História Completa
                  </h3>
                  <textarea
                    value={generatedData.fullStoryText}
                    onChange={(e) => handleEditMain('fullStoryText', e.target.value)}
                    className="w-full bg-transparent text-slate-300 leading-relaxed text-lg border-none focus:ring-0 focus:outline-none resize-y min-h-[200px]"
                  />
                </div>

                <div className="space-y-12">
                  {generatedData.scenes.map((scene: any, index: number) => (
                    <div key={index} className="bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-800 relative overflow-hidden">
                      {/* Scene Header */}
                      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-800">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center font-display font-bold text-xl text-indigo-400 border border-indigo-500/30">
                          {scene.sceneNumber}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Cenário</h3>
                          <input 
                            value={scene.setting}
                            onChange={(e) => handleEditScene(index, 'setting', e.target.value)}
                            className="text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none w-full transition-colors"
                          />
                        </div>
                      </div>

                      {/* Action & Dialogue */}
                      <div className="mb-8">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-indigo-400" /> Ação e Diálogos
                        </h4>
                        <textarea
                          value={scene.actionAndDialogue}
                          onChange={(e) => handleEditScene(index, 'actionAndDialogue', e.target.value)}
                          className="w-full p-6 bg-slate-950 rounded-2xl text-slate-300 leading-relaxed text-lg border border-slate-800 focus:border-indigo-500 focus:outline-none resize-y min-h-[150px]"
                        />
                      </div>

                      {/* Prompts Grid */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Image Prompt */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-cyan-400" /> Prompt Nano Banana
                            </h4>
                            <button 
                              onClick={() => copyToClipboard(scene.imagePrompt)}
                              className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800"
                              title="Copiar Prompt de Imagem"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea
                            value={scene.imagePrompt}
                            onChange={(e) => handleEditScene(index, 'imagePrompt', e.target.value)}
                            className="w-full p-4 bg-slate-950 text-slate-300 rounded-2xl text-sm font-mono leading-relaxed h-full min-h-[120px] border border-slate-800 focus:border-cyan-500 focus:outline-none resize-y"
                          />
                        </div>

                        {/* Video Prompt */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                              <Video className="w-4 h-4 text-indigo-400" /> Prompt {videoAI} ({duration})
                            </h4>
                            <button 
                              onClick={() => copyToClipboard(`${scene.videoPrompt} Speech (PT-BR): "${scene.actionAndDialogue}"`)}
                              className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800"
                              title="Copiar Prompt de Vídeo com Diálogos"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea
                            value={scene.videoPrompt}
                            onChange={(e) => handleEditScene(index, 'videoPrompt', e.target.value)}
                            className="w-full p-4 bg-slate-950 text-slate-300 rounded-2xl text-sm font-mono leading-relaxed h-full min-h-[120px] border border-slate-800 focus:border-indigo-500 focus:outline-none resize-y"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'character' ? (
          <>
            {!generatedCharacter && !isGeneratingCharacter && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-50">
                <div className="w-24 h-24 border border-slate-700 rounded-full flex items-center justify-center mb-6 bg-slate-900">
                  <UserCircle className="w-10 h-10 text-fuchsia-400" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-2 text-white">Criar Personagem</h2>
                <p className="text-sm text-slate-400">Envie uma imagem de referência e descreva o personagem para gerar o perfil e o prompt.</p>
              </div>
            )}

            {isGeneratingCharacter && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-24 h-24 border-4 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin mb-6" />
                <h2 className="font-display text-2xl font-bold mb-2 text-white animate-pulse">Criando Personagem...</h2>
                <p className="text-sm text-slate-400">Analisando a descrição e a imagem para gerar o perfil perfeito.</p>
              </div>
            )}

            {generatedCharacter && !isGeneratingCharacter && (
              <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="bg-slate-900 rounded-3xl p-8 md:p-12 shadow-xl border border-slate-800">
                  <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
                    {characterImage && (
                      <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden shrink-0 border border-slate-700 shadow-lg">
                        <img src={characterImage} alt="Referência" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h2 className="font-display text-4xl font-extrabold text-white mb-2">
                        {generatedCharacter.name}
                      </h2>
                      <div className="inline-block px-4 py-1.5 bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                        {generatedCharacter.species}
                      </div>
                      
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Personalidade e Papel</h4>
                      <p className="text-slate-300 leading-relaxed text-lg">
                        {generatedCharacter.personality}
                      </p>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-cyan-400" /> Prompt Nano Banana 2 (JSON)
                      </h4>
                      <button 
                        onClick={() => copyToClipboard(JSON.stringify(generatedCharacter, null, 2))}
                        className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800"
                        title="Copiar JSON Completo"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-6 bg-slate-950 text-slate-300 rounded-2xl text-sm font-mono leading-relaxed overflow-x-auto border border-slate-800">
                      <pre>{JSON.stringify(generatedCharacter, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'camera' ? (
          <>
            {!generatedCameras && !isGeneratingCamera && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-50">
                <div className="w-24 h-24 border border-slate-700 rounded-full flex items-center justify-center mb-6 bg-slate-900">
                  <Camera className="w-10 h-10 text-amber-400" />
                </div>
                <h2 className="font-display text-2xl font-bold mb-2 text-white">Ângulos de Câmera</h2>
                <p className="text-sm text-slate-400">Descreva uma cena para gerar prompts consistentes em diferentes ângulos e distâncias.</p>
              </div>
            )}

            {isGeneratingCamera && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-24 h-24 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-6" />
                <h2 className="font-display text-2xl font-bold mb-2 text-white animate-pulse">Posicionando Câmeras...</h2>
                <p className="text-sm text-slate-400">Criando variações de ângulos e distâncias para a sua cena.</p>
              </div>
            )}

            {generatedCameras && !isGeneratingCamera && (
              <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="mb-12 text-center flex flex-col items-center">
                  {cameraImage && (
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border border-slate-700 shadow-lg mb-6 shrink-0">
                      <img src={cameraImage} alt="Referência" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <h2 className="font-display text-4xl md:text-5xl font-extrabold mb-4 text-white">
                    Múltiplas Câmeras
                  </h2>
                  <p className="text-lg text-amber-300 font-medium max-w-2xl mx-auto">
                    Prompts consistentes para a mesma cena em diferentes ângulos.
                  </p>
                </div>

                <div className="grid gap-6">
                  {generatedCameras.angles.map((angle: any, index: number) => (
                    <div key={index} className="bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-800 relative overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center font-display font-bold text-lg text-amber-400 border border-amber-500/30">
                            {index + 1}
                          </div>
                          <h3 className="text-xl font-bold text-white">{angle.angleName}</h3>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(angle.prompt)}
                          className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800 flex items-center gap-2 text-sm font-medium"
                          title="Copiar Prompt"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar
                        </button>
                      </div>
                      <div className="p-6 bg-slate-950 text-slate-300 rounded-2xl text-sm font-mono leading-relaxed border border-slate-800">
                        {angle.prompt}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Vault Modal */}
      {showVaultModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-400" />
                Selecione um Personagem do Cofre
              </h3>
              <button 
                onClick={() => setShowVaultModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {vaultCharacters.map((char) => {
                  let mainImage = '';
                  if (char.images && char.images.length > 0) {
                     const imgObj = char.images.find((i:any) => i.type === 'digen') || char.images[0];
                     mainImage = typeof imgObj === 'string' ? imgObj : imgObj.base64;
                  } else if (char.imageBase64) {
                     mainImage = char.imageBase64;
                  }

                  return (
                    <div 
                      key={char.id} 
                      onClick={() => {
                        const newImages: string[] = [];
                        if (char.images) {
                          char.images.forEach((imgObj: any) => {
                            if (typeof imgObj === 'string') newImages.push(imgObj);
                            else if (imgObj && imgObj.base64) newImages.push(imgObj.base64);
                          });
                        } else if (char.imageBase64) {
                          newImages.push(char.imageBase64);
                        }
                        setScriptImages(prev => [...prev, ...newImages]);
                        setShowVaultModal(false);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-3 cursor-pointer hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all group"
                    >
                      <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-900 mb-3 relative">
                        {mainImage ? (
                          <img src={mainImage} alt={char.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <UserCircle className="w-8 h-8 text-slate-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        )}
                      </div>
                      <div className="text-center">
                        <h4 className="text-sm font-bold text-slate-300 truncate" title={char.name}>{char.name}</h4>
                        <span className="text-[10px] text-slate-500">{char.images ? char.images.length : 1} imagem(ns)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
