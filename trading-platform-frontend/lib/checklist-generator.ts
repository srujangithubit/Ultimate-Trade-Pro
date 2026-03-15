import type { Playbook } from './api/playbooks';

// ── Types ──

export interface ChecklistItem {
    id: string;
    rule: string;
    type: 'boolean';
    description: string;
}

export interface ChecklistSection {
    section: string;
    items: ChecklistItem[];
}

export interface GeneratedChecklist {
    strategy_name: string;
    generated_at: string;
    checklist_sections: ChecklistSection[];
}

// ── Section definitions ──

const SECTIONS = [
    'Market Context',
    'Market Structure',
    'Key Levels',
    'Entry Confirmation',
    'Risk Management',
    'Trade Execution',
] as const;

// ── Keyword → Section mapping ──
// Order matters — first match wins.

const CATEGORY_PATTERNS: { pattern: RegExp; section: typeof SECTIONS[number] }[] = [
    // Risk Management
    { pattern: /stop\s*loss|sl\b|risk.?reward|r:?\s*r\b|rr\b|risk\s*per|max\s*loss|drawdown/i, section: 'Risk Management' },
    { pattern: /position\s*siz|lot\s*size|risk\s*%|percent\s*risk/i, section: 'Risk Management' },

    // Market Context
    { pattern: /session|london|new\s*york|tokyo|asian|sydney|htf|higher\s*time\s*frame/i, section: 'Market Context' },
    { pattern: /news|nfp|fomc|cpi|economic|calendar|fundamental/i, section: 'Market Context' },
    { pattern: /trend\s*(direction|bias|alignment)|daily\s*(bias|trend)|weekly\s*(bias|trend)/i, section: 'Market Context' },
    { pattern: /overall\s*(market|trend)|macro/i, section: 'Market Context' },

    // Market Structure
    { pattern: /higher\s*high|higher\s*low|lower\s*high|lower\s*low|hh\b|hl\b|lh\b|ll\b/i, section: 'Market Structure' },
    { pattern: /break\s*of\s*structure|bos\b|choch\b|change\s*of\s*character/i, section: 'Market Structure' },
    { pattern: /impulse|swing|market\s*structure|structural/i, section: 'Market Structure' },
    { pattern: /bullish\s*structure|bearish\s*structure|trend\s*structure/i, section: 'Market Structure' },

    // Key Levels
    { pattern: /fibonacci|fib\b|0\.\d{3}|61\.?8|78\.?6|50\s*%/i, section: 'Key Levels' },
    { pattern: /support|resistance|s\/?r\b|key\s*level/i, section: 'Key Levels' },
    { pattern: /supply|demand|zone|order\s*block|ob\b|fvg\b|fair\s*value\s*gap/i, section: 'Key Levels' },
    { pattern: /liquidity\s*(sweep|grab|pool|raid|hunt)|equal\s*(high|low)/i, section: 'Key Levels' },
    { pattern: /pivot|vwap|ema\s*\d|sma\s*\d|moving\s*average/i, section: 'Key Levels' },

    // Entry Confirmation
    { pattern: /engulfing|pin\s*bar|doji|hammer|shooting\s*star|morning\s*star|evening\s*star/i, section: 'Entry Confirmation' },
    { pattern: /candle|candlestick|pattern|confirmation|trigger|signal/i, section: 'Entry Confirmation' },
    { pattern: /retest|rejection|wick|volume\s*(spike|confirm)|divergence|rsi\b|macd\b/i, section: 'Entry Confirmation' },
    { pattern: /entry|enter\b|buy\b|sell\b/i, section: 'Entry Confirmation' },

    // Trade Execution
    { pattern: /order\s*type|limit\s*order|market\s*order|execute|journal|log\s*trade/i, section: 'Trade Execution' },
    { pattern: /take\s*profit|tp\b|target|partial|trail/i, section: 'Trade Execution' },
];

function categorizeRule(rule: string): typeof SECTIONS[number] {
    for (const { pattern, section } of CATEGORY_PATTERNS) {
        if (pattern.test(rule)) return section;
    }
    // Default: if we can't categorize, put in Entry Confirmation
    return 'Entry Confirmation';
}

// ── Rule → Checklist question conversion ──

function toSnakeCase(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 40);
}

const SECTION_PREFIX: Record<string, string> = {
    'Market Context': 'context',
    'Market Structure': 'structure',
    'Key Levels': 'level',
    'Entry Confirmation': 'entry',
    'Risk Management': 'risk',
    'Trade Execution': 'exec',
};

function ruleToQuestion(rule: string): string {
    const trimmed = rule.trim().replace(/\.$/, '');

    // Already a question
    if (/^(is|has|are|does|do|was|were|can|should|will|did)\s/i.test(trimmed)) {
        return trimmed.endsWith('?') ? trimmed : `${trimmed}?`;
    }

    // Common transformation patterns
    const patterns: { match: RegExp; transform: (m: RegExpMatchArray) => string }[] = [
        {
            match: /^trade\s+only\s+(in|during|on)\s+(.+)/i,
            transform: (m) => `Is the current condition "${m[2]}" met?`,
        },
        {
            match: /^wait\s+for\s+(.+)/i,
            transform: (m) => `Has ${m[1]}?`,
        },
        {
            match: /^(use|confirm|ensure|verify|check)\s+(.+)/i,
            transform: (m) => `Is ${m[2]} confirmed?`,
        },
        {
            match: /^(enter|entry)\s+(on|at|when|after)\s+(.+)/i,
            transform: (m) => `Is the entry condition met: ${m[3]}?`,
        },
        {
            match: /^(place|set)\s+(stop\s*loss|sl)\s+(.+)/i,
            transform: (m) => `Is the stop loss placed ${m[3]}?`,
        },
        {
            match: /^(place|set)\s+(take\s*profit|tp)\s+(.+)/i,
            transform: (m) => `Is the take profit placed ${m[3]}?`,
        },
        {
            match: /^minimum\s+(risk.?reward|r:?\s*r)\s+(.+)/i,
            transform: (m) => `Is the risk/reward ratio at least ${m[2]}?`,
        },
        {
            match: /^(no|don't|do not|avoid|never)\s+(.+)/i,
            transform: (m) => `Have you confirmed there is no ${m[2]}?`,
        },
        {
            match: /^(.+)\s+(required|must|should|needs?\s+to)\s*(.*)$/i,
            transform: (m) => `Is ${m[1]} ${m[3] || 'satisfied'}?`,
        },
    ];

    for (const { match, transform } of patterns) {
        const m = trimmed.match(match);
        if (m) {
            const q = transform(m);
            return q.charAt(0).toUpperCase() + q.slice(1);
        }
    }

    // Generic fallback: "Is <rule> confirmed?"
    const lower = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    return `Is ${lower} confirmed?`;
}

function ruleToDescription(rule: string, section: string): string {
    const descriptions: Record<string, string> = {
        'Market Context': 'Verify this market context condition before proceeding.',
        'Market Structure': 'Confirm market structure aligns with the trade direction.',
        'Key Levels': 'Validate price is at or near the required level/zone.',
        'Entry Confirmation': 'Wait for this confirmation before taking the entry.',
        'Risk Management': 'Ensure risk parameters are within strategy limits.',
        'Trade Execution': 'Complete this execution step before or after entry.',
    };
    return descriptions[section] || 'Verify this condition before trading.';
}

// ── Main generator ──

export function generateChecklist(playbook: Playbook): GeneratedChecklist {
    const rules = playbook.rules || [];

    // Categorize each rule
    const categorized = rules.map((rule) => ({
        rule,
        section: categorizeRule(rule),
    }));

    // Build sections — maintain order, skip empty sections
    const idCounters: Record<string, number> = {};
    const sections: ChecklistSection[] = SECTIONS.map((sectionName) => {
        const sectionRules = categorized.filter((r) => r.section === sectionName);
        const prefix = SECTION_PREFIX[sectionName] || 'item';

        const items: ChecklistItem[] = sectionRules.map((r) => {
            const count = (idCounters[prefix] || 0) + 1;
            idCounters[prefix] = count;
            const slug = toSnakeCase(r.rule);
            const id = `${prefix}_${slug}_${count}`;

            return {
                id,
                rule: ruleToQuestion(r.rule),
                type: 'boolean' as const,
                description: ruleToDescription(r.rule, sectionName),
            };
        });

        return { section: sectionName, items };
    });

    // Always add a final "ready to execute" gate in Trade Execution
    const execSection = sections.find((s) => s.section === 'Trade Execution')!;
    execSection.items.push({
        id: 'exec_all_confirmed',
        rule: 'Are all above conditions confirmed and trade ready to execute?',
        type: 'boolean',
        description: 'Final gate — all checklist items must be TRUE before entry.',
    });

    return {
        strategy_name: playbook.name,
        generated_at: new Date().toISOString(),
        checklist_sections: sections,
    };
}
