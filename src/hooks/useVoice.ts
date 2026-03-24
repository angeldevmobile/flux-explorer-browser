import { useState, useEffect } from "react";
import type { VoiceState } from "@/types/browser";
import { voiceService } from "@/services/voiceService";
import { processVoiceQuery } from "@/services/geminiClient";
import { useToast } from "@/hooks/use-toast";

interface UseVoiceParams {
	activeTabUrl?: string;
	onNavigate: (url: string) => void;
}

export function useVoice({ activeTabUrl, onNavigate }: UseVoiceParams) {
	const { toast } = useToast();
	const [voiceState, setVoiceState] = useState<VoiceState>("idle");
	const [transcription, setTranscription] = useState("");
	const [audioLevels, setAudioLevels] = useState<number[]>(new Array(40).fill(0));
	const [suggestions, setSuggestions] = useState<string[]>([]);

	// Simular niveles de audio mientras escucha
	useEffect(() => {
		if (voiceState !== "listening") return;
		const id = setInterval(
			() => setAudioLevels((p) => p.map(() => Math.random() * 100)),
			100,
		);
		return () => clearInterval(id);
	}, [voiceState]);

	const handleVoiceCommand = async () => {
		if (voiceState !== "idle") {
			voiceService.stopListening();
			voiceService.stopSpeaking();
			setVoiceState("idle");
			setTranscription("");
			setSuggestions([]);
			return;
		}

		if (!voiceService.isSupported()) {
			toast({
				title: "No soportado",
				description: "Tu navegador no soporta reconocimiento de voz",
				variant: "destructive",
			});
			return;
		}

		setVoiceState("listening");
		setTranscription("Escuchando...");
		setSuggestions([]);

		voiceService.startListening(
			async (finalTranscript) => {
				setTranscription(finalTranscript);
				setVoiceState("processing");
				try {
					const result = await processVoiceQuery(finalTranscript, {
						currentUrl: activeTabUrl,
						timestamp: new Date().toISOString(),
					});
					if (result.suggestions) setSuggestions(result.suggestions);
					voiceService.speak(result.response, () => {
						setVoiceState("results");
						if (result.action === "navigate" && result.url) onNavigate(result.url);
						else if (result.action === "search" && result.query) onNavigate(result.query);
						setTimeout(() => {
							setVoiceState("idle");
							setTranscription("");
							setSuggestions([]);
						}, 3000);
					});
				} catch {
					voiceService.speak("Lo siento, hubo un error procesando tu solicitud");
					setVoiceState("idle");
					setTranscription("");
					toast({
						title: "Error",
						description: "No se pudo procesar tu solicitud",
						variant: "destructive",
					});
				}
			},
			() => {
				setVoiceState("idle");
				setTranscription("");
				toast({
					title: "Error",
					description: "No se pudo activar el micrófono",
					variant: "destructive",
				});
			},
			(interim) => setTranscription(interim),
		);
	};

	return { voiceState, transcription, audioLevels, suggestions, handleVoiceCommand };
}
