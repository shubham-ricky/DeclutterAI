/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  Upload, 
  Sparkles, 
  MessageSquare, 
  Trash2, 
  Camera, 
  ChevronRight, 
  LayoutGrid, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  X
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface AnalysisResult {
  id: string;
  imageUrl: string;
  timestamp: number;
  suggestions: string;
  roomType: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// --- Constants ---

const MODEL_NAME = "gemini-3.1-pro-preview";

export default function App() {
  const [images, setImages] = useState<AnalysisResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // --- Handlers ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImage(file);
  };

  const processImage = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const base64Data = await fileToBase64(file);
      const imageUrl = URL.createObjectURL(file);

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data.split(',')[1],
              },
            },
            {
              text: "Analyze this room photo. Identify the room type and provide specific, actionable decluttering and organization suggestions. Format the response as follows:\nRoom Type: [Type]\n\nSuggestions:\n- [Suggestion 1]\n- [Suggestion 2]\n...",
            },
          ],
        },
      });

      const resultText = response.text || "No suggestions generated.";
      const roomTypeMatch = resultText.match(/Room Type:\s*(.*)/i);
      const roomType = roomTypeMatch ? roomTypeMatch[1].trim() : "Unknown Room";

      const newResult: AnalysisResult = {
        id: Math.random().toString(36).substring(7),
        imageUrl,
        timestamp: Date.now(),
        suggestions: resultText,
        roomType,
      };

      setImages(prev => [newResult, ...prev]);
      setSelectedImage(newResult);
      
      // Auto-start chat with a context
      setChatMessages([
        { role: 'model', text: `I've analyzed your ${roomType}. How can I help you further with organizing this space?` }
      ]);

    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Failed to analyze image. Please check your API key and connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isChatting) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatting(true);

    try {
      const chat = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: selectedImage 
            ? `You are an expert interior organizer. You are currently helping the user with their ${selectedImage.roomType}. Use the previous analysis as context: ${selectedImage.suggestions}`
            : "You are an expert interior organizer. Help the user declutter and organize their home.",
        },
      });

      // Simple history mapping
      const history = chatMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          ...history,
          { role: 'user', parts: [{ text: userMsg }] }
        ]
      });

      setChatMessages(prev => [...prev, { role: 'model', text: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (err) {
      console.error("Chat failed:", err);
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const deleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => prev.filter(img => img.id !== id));
    if (selectedImage?.id === id) {
      setSelectedImage(null);
      setChatMessages([]);
    }
  };

  // --- Render Helpers ---

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-200">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">DeclutterAI</h1>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">New Analysis</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Gallery & Upload */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              Your Spaces
            </h2>
            
            {images.length === 0 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group"
              >
                <div className="bg-slate-50 p-4 rounded-full group-hover:bg-emerald-100 transition-colors">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-600" />
                </div>
                <p className="text-slate-500 text-center font-medium">
                  Upload a photo of your room to start decluttering
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {images.map((img) => (
                  <div 
                    key={img.id}
                    onClick={() => setSelectedImage(img)}
                    className={cn(
                      "relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all group",
                      selectedImage?.id === img.id ? "border-emerald-500 ring-4 ring-emerald-50" : "border-transparent hover:border-slate-300"
                    )}
                  >
                    <img src={img.imageUrl} alt={img.roomType} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <span className="text-white text-[10px] font-bold uppercase truncate">{img.roomType}</span>
                    </div>
                    <button 
                      onClick={(e) => deleteImage(img.id, e)}
                      className="absolute top-1 right-1 p-1.5 bg-white/90 rounded-full text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Right Column: Analysis & Chat */}
        <div className="lg:col-span-8 space-y-6">
          {isAnalyzing ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-6 shadow-sm animate-pulse">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-emerald-600 animate-bounce" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Analyzing your space...</h3>
                <p className="text-slate-500">Gemini is finding the best ways to organize your room.</p>
              </div>
            </div>
          ) : selectedImage ? (
            <div className="space-y-6">
              {/* Analysis Card */}
              <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-1/2 aspect-[4/3] md:aspect-auto">
                    <img src={selectedImage.imageUrl} alt="Room" className="w-full h-full object-cover" />
                  </div>
                  <div className="md:w-1/2 p-8 space-y-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                        <CheckCircle2 className="w-4 h-4" />
                        Analysis Complete
                      </div>
                      <h2 className="text-3xl font-bold text-slate-900">{selectedImage.roomType}</h2>
                    </div>
                    
                    <div className="prose prose-slate prose-sm max-w-none">
                      <Markdown>{selectedImage.suggestions}</Markdown>
                    </div>
                  </div>
                </div>
              </section>

              {/* Chat Panel */}
              <section className="bg-white rounded-3xl border border-slate-200 flex flex-col h-[600px] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Organization Assistant</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Powered by Gemini 3.1 Pro</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                      <div className="bg-slate-50 p-4 rounded-full">
                        <MessageSquare className="w-8 h-8 text-slate-300" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-900 font-bold">Ask anything about this room</p>
                        <p className="text-sm text-slate-500">"Where should I put the bookshelf?" or "How can I maximize storage?"</p>
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex w-full",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-slate-900 text-white rounded-tr-none" 
                          : "bg-slate-100 text-slate-800 rounded-tl-none"
                      )}>
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        <span className="text-xs text-slate-500 font-medium">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <div className="relative flex items-center">
                    <input 
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask for more tips..."
                      className="w-full bg-white border border-slate-200 rounded-2xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isChatting}
                      className="absolute right-2 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="bg-emerald-50 p-6 rounded-full mb-6">
                <Sparkles className="w-12 h-12 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Ready to transform your space?</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-8">
                Upload a photo of any room, and our AI will provide personalized organization and decluttering advice.
              </p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-emerald-600 text-white px-8 py-3 rounded-full font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-bold tracking-tight">DeclutterAI</span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            © {new Date().getFullYear()} DeclutterAI. Powered by Gemini 3.1 Pro.
          </p>
          <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-slate-400">
            <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
