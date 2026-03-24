import {
	Youtube,
	Github,
	Twitter,
	Mail,
	Zap,
	Activity,
	Globe,
	TrendingUp,
} from "lucide-react";
import type { Tab } from "@/types/browser";

export const QUICK_ACCESS = [
	{ title: "YouTube", url: "youtube.com", icon: Youtube },
	{ title: "GitHub", url: "github.com", icon: Github },
	{ title: "Twitter", url: "twitter.com", icon: Twitter },
	{ title: "Gmail", url: "gmail.com", icon: Mail },
	{ title: "Netflix", url: "netflix.com", icon: Zap },
	{ title: "Spotify", url: "spotify.com", icon: Activity },
	{ title: "LinkedIn", url: "linkedin.com", icon: Globe },
	{ title: "Reddit", url: "reddit.com", icon: TrendingUp },
];

export const DEFAULT_TAB: Tab = {
	id: "default",
	title: "Bienvenido a Flux",
	url: "orion://welcome",
};
