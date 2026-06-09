/**
 * SVGO Configuration for Long Hall Game
 * 
 * Optimizes SVG assets for smaller file sizes and faster rendering.
 * Run with: npm run optimize:svg
 * 
 * @see https://github.com/svg/svgo
 */
export default {
  // Use multiple passes for better optimization
  multipass: true,
  
  // Plugins configuration
  plugins: [
    // === CLEANUP PLUGINS ===
    
    // Remove XML declaration and doctype
    'removeXMLProcInst',
    'removeDoctype',
    
    // Remove comments
    'removeComments',
    
    // Remove <metadata> elements
    'removeMetadata',
    
    // Remove editor-specific elements and attributes
    'removeEditorsNSData',
    
    // Remove empty attributes
    'removeEmptyAttrs',
    
    // Remove empty containers (like empty <g> elements)
    'removeEmptyContainers',
    
    // Remove empty text elements
    'removeEmptyText',
    
    // Remove hidden elements
    'removeHiddenElems',
    
    // Remove useless <defs> elements
    'removeUselessDefs',
    
    // Remove useless stroke and fill attributes
    'removeUselessStrokeAndFill',
    
    // Remove unused namespaces
    'removeUnusedNS',
    
    // Clean up IDs and references
    'cleanupIds',
    
    // Clean up numeric values (remove default values, trailing zeros)
    'cleanupNumericValues',
    
    // Clean up list of values (like viewBox, enable-background)
    'cleanupListOfValues',
    
    // Move styles from style attributes to classes where possible
    'moveElemsAttrsToGroup',
    
    // Move group attributes to contained elements
    'moveGroupAttrsToElems',
    
    // Collapse useless groups
    'collapseGroups',
    
    // Convert colors to shorter format
    'convertColors',
    
    // Convert paths to more compact forms
    {
      name: 'convertPathData',
      params: {
        floatPrecision: 2,
        transformPrecision: 2,
        makeArcs: {
          threshold: 2.5,
          tolerance: 0.5,
        },
      },
    },
    
    // Convert shapes to paths
    {
      name: 'convertShapeToPath',
      params: {
        convertArcs: true,
      },
    },
    
    // Convert transforms to matrix
    {
      name: 'convertTransform',
      params: {
        floatPrecision: 2,
      },
    },
    
    // Merge paths where possible
    'mergePaths',
    
    // Remove dimensions and rely on viewBox
    {
      name: 'removeDimensions',
    },
    
    // Remove specific attributes
    {
      name: 'removeAttrs',
      params: {
        attrs: [
          'data-name',           // Common from design tools
          'xmlns:xlink',         // Legacy xlink namespace
          'xml:space',           // XML whitespace handling
          'class',               // Remove classes (can be re-added programmatically)
        ],
      },
    },
    
    // Sort attributes for consistent output
    'sortAttrs',
    
    // Sort children for consistent output
    'sortDefsChildren',
    
    // === PRESERVE IMPORTANT ELEMENTS ===
    
    // Don't remove viewBox (critical for responsive SVGs)
    {
      name: 'removeViewBox',
      active: false,
    },
    
    // Preserve title for accessibility (if present)
    {
      name: 'removeTitle',
      active: false,
    },
    
    // Preserve desc for accessibility (if present)
    {
      name: 'removeDesc',
      params: {
        removeAny: false,
      },
    },
    
    // Add width/height attributes for non-inline SVGs
    {
      name: 'addAttributesToSVGElement',
      params: {
        attributes: [
          { 'aria-hidden': 'true' }, // Decorative by default; override in component
        ],
      },
    },
    
    // Prefix IDs to prevent conflicts
    {
      name: 'prefixIds',
      params: {
        delim: '_',
        prefixIds: true,
        prefixClassNames: true,
      },
    },
  ],
};
