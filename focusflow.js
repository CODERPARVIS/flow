const { useState, useEffect, useCallback, createContext, useContext } = React;

// Audio Manager
class AudioManager {
    constructor() {
        this.context = null;
        this.sounds = {};
    }

    async initializeAudio() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    async createTone(frequency, duration, type = 'sine') {
        await this.initializeAudio();
        
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
        
        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + duration);
        
        return new Promise(resolve => {
            oscillator.onended = resolve;
        });
    }

    async playSound(type) {
        try {
            switch (type) {
                case 'start':
                    await this.createTone(440, 0.2);
                    break;
                case 'complete':
                    await this.createTone(523, 0.3);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await this.createTone(659, 0.3);
                    break;
                case 'tick':
                    await this.createTone(800, 0.1);
                    break;
                case 'achievement':
                    await this.createTone(523, 0.2);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await this.createTone(659, 0.2);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await this.createTone(784, 0.3);
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.log('Audio playback failed:', error);
        }
    }
}

const audioManager = new AudioManager();

// Storage utilities
const storage = {
    get: (key, defaultValue = null) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Storage error:', error);
        }
    }
};

// Theme Context
const ThemeContext = createContext();

function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => storage.get('theme', 'forest'));
    const [colorMode, setColorMode] = useState(() => storage.get('colorMode', 'light'));

    useEffect(() => {
        storage.set('theme', theme);
        storage.set('colorMode', colorMode);
        
        // Apply classes to document
        document.documentElement.className = '';
        document.documentElement.classList.add(`theme-${theme}`);
        if (colorMode === 'dark') {
            document.documentElement.classList.add('dark');
        }
        
        // Also apply to body for better coverage
        document.body.className = `theme-${theme} ${colorMode} bg-background text-foreground transition-colors duration-300`;
    }, [theme, colorMode]);

    const toggleColorMode = useCallback(() => {
        setColorMode(mode => mode === 'light' ? 'dark' : 'light');
    }, []);

    const value = {
        theme,
        setTheme: useCallback((newTheme) => setTheme(newTheme), []),
        colorMode,
        setColorMode,
        toggleColorMode
    };

    return React.createElement(ThemeContext.Provider, {
        value: value
    }, children);
}

function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}

// Timer Hook
function useTimer() {
    const [time, setTime] = useState(25 * 60);
    const [totalTime, setTotalTime] = useState(25 * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [phase, setPhase] = useState('focus');
    const [cycle, setCycle] = useState(1);
    const [settings, setSettings] = useState({
        focusTime: 25,
        shortBreak: 5,
        longBreak: 15
    });

    useEffect(() => {
        const savedSettings = storage.get('timer-settings');
        if (savedSettings) {
            setSettings(savedSettings);
            const focusTime = savedSettings.focusTime * 60;
            setTime(focusTime);
            setTotalTime(focusTime);
        }
    }, []);

    useEffect(() => {
        let interval;
        if (isRunning && time > 0) {
            interval = setInterval(() => {
                setTime(prevTime => {
                    if (prevTime <= 1) {
                        completeSession();
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning, time]);

    const completeSession = useCallback(() => {
        audioManager.playSound('complete');
        setIsRunning(false);
        
        if (phase === 'focus') {
            const nextPhase = cycle % 4 === 0 ? 'longBreak' : 'shortBreak';
            const nextTime = nextPhase === 'longBreak' ? settings.longBreak * 60 : settings.shortBreak * 60;
            setPhase(nextPhase);
            setTime(nextTime);
            setTotalTime(nextTime);
            setCycle(prev => prev + 1);
        } else {
            const nextTime = settings.focusTime * 60;
            setPhase('focus');
            setTime(nextTime);
            setTotalTime(nextTime);
        }
    }, [phase, cycle, settings]);

    const startTimer = () => {
        audioManager.playSound('start');
        setIsRunning(true);
    };

    const pauseTimer = () => {
        setIsRunning(false);
    };

    const resetTimer = () => {
        setIsRunning(false);
        const currentPhaseTime = phase === 'focus' ? settings.focusTime * 60 :
                               phase === 'shortBreak' ? settings.shortBreak * 60 :
                               settings.longBreak * 60;
        setTime(currentPhaseTime);
        setTotalTime(currentPhaseTime);
    };

    const skipPhase = () => {
        completeSession();
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const updateSettings = (newSettings) => {
        setSettings(newSettings);
        storage.set('timer-settings', newSettings);
        
        if (!isRunning) {
            const currentPhaseTime = phase === 'focus' ? newSettings.focusTime * 60 :
                                   phase === 'shortBreak' ? newSettings.shortBreak * 60 :
                                   newSettings.longBreak * 60;
            setTime(currentPhaseTime);
            setTotalTime(currentPhaseTime);
        }
    };

    return {
        time,
        totalTime,
        isRunning,
        phase,
        cycle,
        settings,
        startTimer,
        pauseTimer,
        resetTimer,
        skipPhase,
        formatTime,
        updateSettings
    };
}

// Gamification Hook
function useGamification() {
    const [user, setUser] = useState(() => storage.get('user', {
        level: 1,
        currentXP: 0,
        totalXP: 0,
        streak: 0,
        lastActiveDate: new Date().toISOString().split('T')[0]
    }));

    const [achievements, setAchievements] = useState(() => storage.get('achievements', []));
    const [dailyTasks, setDailyTasks] = useState(() => {
        const today = new Date().toISOString().split('T')[0];
        const saved = storage.get('daily-tasks', []);
        const todayData = saved.find(task => task.date === today);
        
        if (!todayData) {
            const defaultTasks = [
                { id: 'focus1', type: 'focus', title: 'Complete 3 Focus Sessions', description: 'Stay focused for 3 complete sessions', target: 3, current: 0, completed: false, xpReward: 50 },
                { id: 'streak1', type: 'streak', title: 'Keep Your Streak', description: 'Maintain your daily activity streak', target: 1, current: 0, completed: false, xpReward: 25 },
                { id: 'time1', type: 'time', title: 'Focus for 2 Hours', description: 'Complete 2 hours of focused work', target: 120, current: 0, completed: false, xpReward: 75 }
            ];
            const newData = [...saved, { date: today, tasks: defaultTasks }];
            storage.set('daily-tasks', newData);
            return newData;
        }
        return saved;
    });

    useEffect(() => {
        storage.set('user', user);
    }, [user]);

    useEffect(() => {
        storage.set('achievements', achievements);
    }, [achievements]);

    useEffect(() => {
        storage.set('daily-tasks', dailyTasks);
    }, [dailyTasks]);

    const addXP = useCallback((amount) => {
        setUser(prev => {
            const newXP = prev.currentXP + amount;
            const xpForNextLevel = 1000;
            
            if (newXP >= xpForNextLevel) {
                const newLevel = prev.level + 1;
                audioManager.playSound('achievement');
                return {
                    ...prev,
                    level: newLevel,
                    currentXP: newXP - xpForNextLevel,
                    totalXP: prev.totalXP + amount
                };
            }
            
            return {
                ...prev,
                currentXP: newXP,
                totalXP: prev.totalXP + amount
            };
        });
    }, []);

    const completeSession = useCallback((phase) => {
        if (phase === 'focus') {
            addXP(25);
            updateDailyTasks();
        }
    }, [addXP]);

    const updateDailyTasks = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];
        
        setDailyTasks(prev => {
            return prev.map(taskGroup => {
                if (taskGroup.date === today) {
                    const updatedTasks = taskGroup.tasks.map(task => {
                        if (task.type === 'focus' && !task.completed) {
                            const newCurrent = task.current + 1;
                            if (newCurrent >= task.target) {
                                addXP(task.xpReward);
                                return { ...task, current: newCurrent, completed: true };
                            }
                            return { ...task, current: newCurrent };
                        }
                        return task;
                    });
                    return { ...taskGroup, tasks: updatedTasks };
                }
                return taskGroup;
            });
        });
    }, [addXP]);

    const getTodayTasks = () => {
        const today = new Date().toISOString().split('T')[0];
        const todayData = dailyTasks.find(task => task.date === today);
        return todayData?.tasks || [];
    };

    return {
        user,
        achievements,
        dailyTasks: getTodayTasks(),
        addXP,
        completeSession
    };
}

// Timer Circle Component
function TimerCircle({ time, totalTime, isRunning, children }) {
    const radius = 120;
    const circumference = 2 * Math.PI * radius;
    const progress = totalTime > 0 ? (totalTime - time) / totalTime : 0;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress * circumference);

    return React.createElement('div', {
        className: 'relative flex items-center justify-center'
    }, [
        React.createElement('svg', {
            key: 'svg',
            width: 280,
            height: 280,
            className: 'transform -rotate-90'
        }, [
            React.createElement('circle', {
                key: 'bg-circle',
                cx: 140,
                cy: 140,
                r: radius,
                stroke: 'hsl(var(--border))',
                strokeWidth: 8,
                fill: 'none'
            }),
            React.createElement('circle', {
                key: 'progress-circle',
                cx: 140,
                cy: 140,
                r: radius,
                stroke: 'hsl(var(--primary))',
                strokeWidth: 8,
                fill: 'none',
                strokeDasharray,
                strokeDashoffset,
                className: `timer-circle ${isRunning ? 'pulse-animation' : ''}`,
                strokeLinecap: 'round'
            })
        ]),
        React.createElement('div', {
            key: 'content',
            className: 'absolute inset-0 flex items-center justify-center'
        }, children)
    ]);
}

// Settings Component
function Settings({ settings, onUpdate }) {
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleUpdate = useCallback((key, value) => {
        const newSettings = { ...localSettings, [key]: parseInt(value) || 1 };
        setLocalSettings(newSettings);
        onUpdate(newSettings);
    }, [localSettings, onUpdate]);

    return React.createElement('div', {
        className: 'card space-y-4'
    }, [
        React.createElement('h3', {
            key: 'title',
            className: 'text-lg font-semibold'
        }, 'Timer Settings'),
        React.createElement('div', {
            key: 'focus-setting',
            className: 'space-y-2'
        }, [
            React.createElement('label', {
                key: 'focus-label',
                className: 'text-sm font-medium block'
            }, 'Focus Time (minutes)'),
            React.createElement('input', {
                key: 'focus-input',
                type: 'number',
                min: 1,
                max: 60,
                value: localSettings.focusTime,
                onChange: (e) => handleUpdate('focusTime', e.target.value),
                className: 'w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
            })
        ]),
        React.createElement('div', {
            key: 'short-break-setting',
            className: 'space-y-2'
        }, [
            React.createElement('label', {
                key: 'short-break-label',
                className: 'text-sm font-medium block'
            }, 'Short Break (minutes)'),
            React.createElement('input', {
                key: 'short-break-input',
                type: 'number',
                min: 1,
                max: 30,
                value: localSettings.shortBreak,
                onChange: (e) => handleUpdate('shortBreak', e.target.value),
                className: 'w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
            })
        ]),
        React.createElement('div', {
            key: 'long-break-setting',
            className: 'space-y-2'
        }, [
            React.createElement('label', {
                key: 'long-break-label',
                className: 'text-sm font-medium block'
            }, 'Long Break (minutes)'),
            React.createElement('input', {
                key: 'long-break-input',
                type: 'number',
                min: 1,
                max: 60,
                value: localSettings.longBreak,
                onChange: (e) => handleUpdate('longBreak', e.target.value),
                className: 'w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
            })
        ])
    ]);
}

// Theme Selector Component
function ThemeSelector() {
    const { theme, setTheme, colorMode, toggleColorMode } = useTheme();

    const themes = [
        { id: 'forest', name: 'Forest', description: 'Calming green tones' },
        { id: 'lavender', name: 'Lavender', description: 'Peaceful purple hues' },
        { id: 'sunset', name: 'Sunset', description: 'Warm orange vibes' }
    ];

    const handleThemeChange = useCallback((themeId) => {
        setTheme(themeId);
    }, [setTheme]);

    return React.createElement('div', {
        className: 'card space-y-4'
    }, [
        React.createElement('div', {
            key: 'header',
            className: 'flex items-center justify-between'
        }, [
            React.createElement('h3', {
                key: 'title',
                className: 'text-lg font-semibold'
            }, 'Appearance'),
            React.createElement('button', {
                key: 'toggle',
                onClick: toggleColorMode,
                className: 'btn btn-outline px-3 py-1',
                type: 'button'
            }, colorMode === 'light' ? '🌙 Dark' : '☀️ Light')
        ]),
        React.createElement('div', {
            key: 'themes',
            className: 'space-y-2'
        }, [
            React.createElement('label', {
                key: 'label',
                className: 'text-sm font-medium'
            }, 'Theme'),
            React.createElement('div', {
                key: 'theme-grid',
                className: 'grid grid-cols-1 gap-2'
            }, themes.map(themeOption => 
                React.createElement('button', {
                    key: themeOption.id,
                    onClick: () => handleThemeChange(themeOption.id),
                    type: 'button',
                    className: `p-3 rounded-md border-2 text-left transition-colors ${
                        theme === themeOption.id 
                            ? 'border-primary bg-accent' 
                            : 'border-border hover:border-primary/50'
                    }`
                }, [
                    React.createElement('div', {
                        key: 'name',
                        className: 'font-medium'
                    }, themeOption.name),
                    React.createElement('div', {
                        key: 'description',
                        className: 'text-sm text-muted-foreground'
                    }, themeOption.description)
                ])
            ))
        ])
    ]);
}

// Stats Component
function Stats({ user, dailyTasks }) {
    const xpProgress = (user.currentXP / 1000) * 100;
    const completedTasks = dailyTasks.filter(task => task.completed).length;

    return React.createElement('div', {
        className: 'card space-y-4'
    }, [
        React.createElement('h3', {
            key: 'title',
            className: 'text-lg font-semibold'
        }, 'Your Progress'),
        React.createElement('div', {
            key: 'level',
            className: 'space-y-2'
        }, [
            React.createElement('div', {
                key: 'level-info',
                className: 'flex justify-between items-center'
            }, [
                React.createElement('span', {
                    key: 'level-text',
                    className: 'text-sm font-medium'
                }, `Level ${user.level}`),
                React.createElement('span', {
                    key: 'xp-text',
                    className: 'text-sm text-muted-foreground'
                }, `${user.currentXP}/1000 XP`)
            ]),
            React.createElement('div', {
                key: 'progress-bar',
                className: 'progress-bar'
            }, React.createElement('div', {
                className: 'progress-fill',
                style: { width: `${xpProgress}%` }
            }))
        ]),
        React.createElement('div', {
            key: 'stats-grid',
            className: 'grid grid-cols-2 gap-4'
        }, [
            React.createElement('div', {
                key: 'streak',
                className: 'text-center'
            }, [
                React.createElement('div', {
                    key: 'streak-number',
                    className: 'text-2xl font-bold text-primary'
                }, user.streak),
                React.createElement('div', {
                    key: 'streak-label',
                    className: 'text-sm text-muted-foreground'
                }, 'Day Streak')
            ]),
            React.createElement('div', {
                key: 'tasks',
                className: 'text-center'
            }, [
                React.createElement('div', {
                    key: 'tasks-number',
                    className: 'text-2xl font-bold text-primary'
                }, `${completedTasks}/${dailyTasks.length}`),
                React.createElement('div', {
                    key: 'tasks-label',
                    className: 'text-sm text-muted-foreground'
                }, 'Daily Tasks')
            ])
        ])
    ]);
}

// Daily Tasks Component
function DailyTasks({ tasks }) {
    return React.createElement('div', {
        className: 'card space-y-4'
    }, [
        React.createElement('h3', {
            key: 'title',
            className: 'text-lg font-semibold'
        }, 'Daily Challenges'),
        React.createElement('div', {
            key: 'tasks-list',
            className: 'space-y-3'
        }, tasks.map(task => 
            React.createElement('div', {
                key: task.id,
                className: `p-3 rounded-md border ${task.completed ? 'bg-accent border-success' : 'border-border'}`
            }, [
                React.createElement('div', {
                    key: 'task-header',
                    className: 'flex items-center justify-between'
                }, [
                    React.createElement('div', {
                        key: 'task-info',
                        className: 'flex-1'
                    }, [
                        React.createElement('div', {
                            key: 'task-title',
                            className: `font-medium ${task.completed ? 'text-success' : ''}`
                        }, task.title),
                        React.createElement('div', {
                            key: 'task-description',
                            className: 'text-sm text-muted-foreground'
                        }, task.description)
                    ]),
                    React.createElement('div', {
                        key: 'task-badge',
                        className: `badge ${task.completed ? 'badge-default' : 'badge-outline'}`
                    }, task.completed ? '✓' : `${task.current}/${task.target}`)
                ]),
                !task.completed && React.createElement('div', {
                    key: 'task-progress',
                    className: 'mt-2 progress-bar'
                }, React.createElement('div', {
                    className: 'progress-fill',
                    style: { width: `${(task.current / task.target) * 100}%` }
                }))
            ])
        ))
    ]);
}

// Main Timer Page Component
function TimerPage() {
    const timer = useTimer();
    const gamification = useGamification();
    const [showSettings, setShowSettings] = useState(false);

    const handleSessionComplete = () => {
        if (timer.phase === 'focus') {
            gamification.completeSession('focus');
        }
    };

    useEffect(() => {
        if (!timer.isRunning && timer.time === 0) {
            handleSessionComplete();
        }
    }, [timer.isRunning, timer.time]);

    const getPhaseText = () => {
        switch (timer.phase) {
            case 'focus': return 'Focus Time';
            case 'shortBreak': return 'Short Break';
            case 'longBreak': return 'Long Break';
            default: return 'Focus Time';
        }
    };

    const getPhaseColor = () => {
        switch (timer.phase) {
            case 'focus': return 'text-primary';
            case 'shortBreak': return 'text-blue-500';
            case 'longBreak': return 'text-green-500';
            default: return 'text-primary';
        }
    };

    return React.createElement('div', {
        className: 'min-h-screen bg-background transition-colors duration-300'
    }, [
        React.createElement('div', {
            key: 'container',
            className: 'container mx-auto px-4 py-8 max-w-6xl'
        }, [
            React.createElement('div', {
                key: 'header',
                className: 'text-center mb-8'
            }, [
                React.createElement('h1', {
                    key: 'title',
                    className: 'text-4xl font-bold mb-2'
                }, 'FocusFlow'),
                React.createElement('p', {
                    key: 'subtitle',
                    className: 'text-muted-foreground'
                }, 'Gamified Pomodoro Timer')
            ]),

            React.createElement('div', {
                key: 'main-content',
                className: 'grid grid-cols-1 lg:grid-cols-3 gap-8'
            }, [
                React.createElement('div', {
                    key: 'timer-section',
                    className: 'lg:col-span-2 space-y-6'
                }, [
                    React.createElement('div', {
                        key: 'timer-card',
                        className: 'card text-center'
                    }, [
                        React.createElement('div', {
                            key: 'phase-info',
                            className: 'mb-6'
                        }, [
                            React.createElement('h2', {
                                key: 'phase-title',
                                className: `text-2xl font-semibold ${getPhaseColor()}`
                            }, getPhaseText()),
                            React.createElement('p', {
                                key: 'cycle-info',
                                className: 'text-muted-foreground'
                            }, `Session ${timer.cycle}`)
                        ]),

                        React.createElement(TimerCircle, {
                            key: 'timer-circle',
                            time: timer.time,
                            totalTime: timer.totalTime,
                            isRunning: timer.isRunning
                        }, React.createElement('div', {
                            className: 'text-center'
                        }, [
                            React.createElement('div', {
                                key: 'time-display',
                                className: 'text-4xl font-mono font-bold mb-2'
                            }, timer.formatTime(timer.time)),
                            React.createElement('div', {
                                key: 'status',
                                className: 'text-sm text-muted-foreground'
                            }, timer.isRunning ? 'Running' : 'Paused')
                        ])),

                        React.createElement('div', {
                            key: 'controls',
                            className: 'flex justify-center space-x-4 mt-6'
                        }, [
                            React.createElement('button', {
                                key: 'play-pause',
                                onClick: () => timer.isRunning ? timer.pauseTimer() : timer.startTimer(),
                                className: 'btn btn-primary px-8',
                                type: 'button'
                            }, timer.isRunning ? 'Pause' : 'Start'),
                            React.createElement('button', {
                                key: 'reset',
                                onClick: () => timer.resetTimer(),
                                className: 'btn btn-secondary',
                                type: 'button'
                            }, 'Reset'),
                            React.createElement('button', {
                                key: 'skip',
                                onClick: () => timer.skipPhase(),
                                className: 'btn btn-outline',
                                type: 'button'
                            }, 'Skip')
                        ])
                    ]),

                    React.createElement('div', {
                        key: 'controls-section',
                        className: 'flex justify-center'
                    }, React.createElement('button', {
                        onClick: () => setShowSettings(!showSettings),
                        className: 'btn btn-outline',
                        type: 'button'
                    }, showSettings ? 'Hide Settings' : 'Show Settings')),

                    showSettings && React.createElement(Settings, {
                        key: 'settings',
                        settings: timer.settings,
                        onUpdate: timer.updateSettings
                    })
                ]),

                React.createElement('div', {
                    key: 'sidebar',
                    className: 'space-y-6'
                }, [
                    React.createElement(ThemeSelector, { key: 'theme-selector' }),
                    React.createElement(Stats, {
                        key: 'stats',
                        user: gamification.user,
                        dailyTasks: gamification.dailyTasks
                    }),
                    React.createElement(DailyTasks, {
                        key: 'daily-tasks',
                        tasks: gamification.dailyTasks
                    })
                ])
            ])
        ])
    ]);
}

// Main App Component
function App() {
    return React.createElement(ThemeProvider, {}, 
        React.createElement(TimerPage, {})
    );
}

// Render the app
ReactDOM.render(React.createElement(App), document.getElementById('root'));