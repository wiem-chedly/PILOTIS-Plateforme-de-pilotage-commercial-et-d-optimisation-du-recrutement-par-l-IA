import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Declare Google Translate types on window
declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement?: unknown;
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

function getCookieLang(): string {
  const match = document.cookie.match(/googtrans=\/fr\/(\w+)/);
  return match ? match[1] : 'fr';
}

function setGoogleTranslateLang(lang: string) {
  if (lang === 'fr') {
    // Reset to French — remove the cookie and reload
    document.cookie = 'googtrans=/fr/fr; path=/';
    document.cookie = 'googtrans=/fr/fr; path=/; domain=' + window.location.hostname;
    window.location.reload();
    return;
  }
  // Set to target language via the hidden Google Translate <select>
  const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (select) {
    select.value = lang;
    select.dispatchEvent(new Event('change'));
  } else {
    // Fallback: set cookie and reload (Google Translate picks it up)
    document.cookie = `googtrans=/fr/${lang}; path=/`;
    document.cookie = `googtrans=/fr/${lang}; path=/; domain=${window.location.hostname}`;
    window.location.reload();
  }
}

export function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState<'fr' | 'en'>('fr');

  useEffect(() => {
    const lang = getCookieLang();
    if (lang === 'en') setCurrentLang('en');
    else setCurrentLang('fr');
  }, []);

  const switchTo = (lang: 'fr' | 'en') => {
    setCurrentLang(lang);
    setGoogleTranslateLang(lang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 rounded-full border border-border hover:bg-accent"
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            {currentLang === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => switchTo('fr')}
          className={`gap-2 cursor-pointer ${currentLang === 'fr' ? 'bg-accent font-semibold' : ''}`}
        >
          🇫🇷 Français
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => switchTo('en')}
          className={`gap-2 cursor-pointer ${currentLang === 'en' ? 'bg-accent font-semibold' : ''}`}
        >
          🇬🇧 English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
