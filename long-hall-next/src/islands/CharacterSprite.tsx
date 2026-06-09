/**
 * CharacterSprite Island Component
 * 
 * Interactive Preact island for character sprites with animation control.
 * Dynamically loads and renders SVG character assets with full animation support.
 * 
 * @module islands/CharacterSprite
 * @see {@link file://./../hooks/useCharacterAnimation.ts} for animation hook
 */

import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import { forwardRef } from 'preact/compat';
import {
  useCharacterAnimation,
  type CharacterType,
  type CharacterName,
  type AnimationState,
  type PlayOptions,
  type UseCharacterAnimationReturn,
} from '../hooks/useCharacterAnimation';

// ============================================================================
// Types
// ============================================================================

export interface CharacterSpriteProps {
  /** Character category: 'hero' or 'enemy' */
  type: CharacterType;
  /** Character name matching SVG filename (e.g., 'fighter', 'goblin') */
  name: CharacterName;
  /** Initial animation state (default: 'idle') */
  initialState?: AnimationState;
  /** Mirror horizontally for left-facing (default: false) */
  flip?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** DOM id for external targeting */
  id?: string;
  /** Callback when animation state changes */
  onStateChange?: (newState: AnimationState) => void;
  /** Callback when animation completes */
  onAnimationComplete?: (state: AnimationState) => void;
  /** Callback at damage point during attacks */
  onDamagePoint?: () => void;
  /** Auto-return to idle after non-terminal states (default: true) */
  autoIdle?: boolean;
}

/**
 * Exposed methods available via ref
 */
export interface CharacterSpriteHandle {
  /** Play an animation state */
  play: (state: AnimationState, options?: PlayOptions) => Promise<void>;
  /** Stop current animation */
  stop: () => void;
  /** Reset to idle */
  reset: () => void;
  /** Current animation state */
  getState: () => AnimationState;
  /** Whether animation is playing */
  isPlaying: () => boolean;
  /** Reference to the SVG element */
  getSvgElement: () => SVGSVGElement | null;
}

// ============================================================================
// SVG Path Resolution
// ============================================================================

/**
 * Resolves the path to an SVG asset based on character type and name
 */
function resolveSvgPath(type: CharacterType, name: CharacterName): string {
  return type === 'hero' 
    ? `/src/art/heroes/${name}.svg`
    : `/src/art/enemies/${name}.svg`;
}

/**
 * For Vite/Astro, we use import.meta.glob to get the raw SVG content
 * This allows inlining SVGs at build time for better performance
 */
const heroSvgs = import.meta.glob('/src/art/heroes/*.svg', { 
  query: '?raw',
  import: 'default',
  eager: false 
});

const enemySvgs = import.meta.glob('/src/art/enemies/*.svg', { 
  query: '?raw',
  import: 'default',
  eager: false 
});

/**
 * Loads SVG content dynamically
 */
async function loadSvgContent(type: CharacterType, name: CharacterName): Promise<string> {
  const path = type === 'hero' 
    ? `/src/art/heroes/${name}.svg`
    : `/src/art/enemies/${name}.svg`;
  
  const loaders = type === 'hero' ? heroSvgs : enemySvgs;
  const loader = loaders[path];
  
  if (!loader) {
    throw new Error(`SVG not found: ${path}`);
  }
  
  const content = await loader();
  return content as string;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * CharacterSprite - Interactive character sprite with animation control
 * 
 * This Preact island component loads SVG character assets and provides
 * full animation control through the useCharacterAnimation hook.
 * 
 * @example
 * ```tsx
 * <CharacterSprite
 *   type="hero"
 *   name="fighter"
 *   initialState="idle"
 *   flip={false}
 *   onStateChange={(state) => console.log('State:', state)}
 *   onDamagePoint={() => applyDamage()}
 * />
 * ```
 * 
 * @example With ref for external control
 * ```tsx
 * const spriteRef = useRef<CharacterSpriteHandle>(null);
 * 
 * // Trigger attack animation
 * await spriteRef.current?.play('attack', { damage: 25 });
 * ```
 */
const CharacterSprite: FunctionalComponent<CharacterSpriteProps> = ({
  type,
  name,
  initialState = 'idle',
  flip = false,
  className = '',
  id,
  onStateChange,
  onAnimationComplete,
  onDamagePoint,
  autoIdle = true,
}) => {
  // SVG content state
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Container ref for the wrapper div
  const containerRef = useRef<HTMLDivElement>(null);
  
  // SVG element ref (populated after content loads)
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Animation hook
  const { state, play, stop, reset, isPlaying } = useCharacterAnimation(
    svgRef as any, // Type cast needed due to null initialization
    initialState,
    {
      onComplete: onAnimationComplete,
      onDamagePoint,
      autoIdle,
    }
  );

  // Load SVG content on mount or when type/name changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const content = await loadSvgContent(type, name);
        if (!cancelled) {
          setSvgContent(content);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load SVG');
          console.error(`[CharacterSprite] Failed to load ${type}/${name}:`, err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [type, name]);

  // Update svgRef when container content changes
  useEffect(() => {
    if (containerRef.current && svgContent) {
      const svg = containerRef.current.querySelector('svg');
      if (svg) {
        svgRef.current = svg as SVGSVGElement;
      }
    }
  }, [svgContent]);

  // Call onStateChange when state updates
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Build container styles with responsive defaults
  const containerStyles: Record<string, string> = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '0',
  };

  // Apply flip transform if needed
  if (flip) {
    containerStyles.transform = 'scaleX(-1)';
  }

  // Build class names - add responsive sprite class
  const containerClasses = [
    'character-sprite',
    `character-sprite--${type}`,
    `character-sprite--${name}`,
    type === 'hero' ? 'hero-sprite' : 'enemy-sprite',
    state === 'idle' ? 'animate-idle' : '',
    isPlaying ? 'is-animating' : '',
    className,
  ].filter(Boolean).join(' ');

  // Render loading state - uses responsive classes from global.css
  if (loading) {
    return (
      <div
        id={id}
        className={`${containerClasses} is-loading sprite-placeholder`}
        style={containerStyles}
        aria-busy="true"
        aria-label={`Loading ${name} sprite...`}
      >
        {/* Loading placeholder with aspect ratio */}
        <div className="sprite-placeholder-inner" style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: '4px',
          aspectRatio: '4 / 5',
        }} />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div
        id={id}
        className={`${containerClasses} has-error`}
        style={{ ...containerStyles, color: 'var(--damage, #ef4444)' }}
        role="img"
        aria-label={`Failed to load ${name}: ${error}`}
      >
        <span style={{ fontSize: '0.75rem' }}>⚠ {name}</span>
      </div>
    );
  }

  // Render SVG content
  return (
    <div
      ref={containerRef}
      id={id}
      className={containerClasses}
      style={containerStyles}
      role="img"
      aria-label={`${name} character sprite`}
      data-state={state}
      data-type={type}
      data-name={name}
      dangerouslySetInnerHTML={{ __html: svgContent ?? '' }}
    />
  );
};

// Export as default for Astro island usage
export default CharacterSprite;

// Also export named for flexibility
export { CharacterSprite };

// Re-export types for consumers
export type {
  CharacterType,
  CharacterName,
  AnimationState,
  PlayOptions,
  UseCharacterAnimationReturn,
};
