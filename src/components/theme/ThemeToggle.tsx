"use client";

import React from 'react';

const STORAGE_KEY = 'theme';

type Theme = 'light' | 'dark';

const getPreferredTheme = () => {
    if (typeof window === 'undefined') return 'light' as Theme;
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
};

export const ThemeToggle = ({ className = '' }: { className?: string }) => {
    const [theme, setTheme] = React.useState<Theme>('light');

    React.useEffect(() => {
        const next = getPreferredTheme();
        setTheme(next);
        document.documentElement.classList.toggle('dark', next === 'dark');
    }, []);

    const toggleTheme = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        document.documentElement.classList.toggle('dark', next === 'dark');
        window.localStorage.setItem(STORAGE_KEY, next);
    };

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={className}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
        </button>
    );
};
