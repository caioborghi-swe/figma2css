import { readFileSync, writeFileSync } from 'fs';

// Input and output file paths
const inputFile = process.argv[2] || './export.json';
const outputFile = process.argv[3] || './design-tokens.css';

// Read and parse the JSON file
const jsonData = JSON.parse(readFileSync(inputFile, 'utf8'));

// Store all variables to resolve references later
const variableMap = new Map();
const cssLines = [];

// Add comment header
cssLines.push('/**');
cssLines.push(' * Design Tokens CSS Variables');
cssLines.push(' * Generated on: ' + new Date().toISOString());
cssLines.push(' */');
cssLines.push('');

// Process the design tokens
function processTokens() {
  // Extract foundation and typography data
  const foundations = jsonData[0]['DIY Foundations'];
  const typography = jsonData[1]?.Typography;
  
  // Start with base tokens section (shared tokens that don't change between themes)
  cssLines.push(':root {');
  cssLines.push('  /* Base design tokens - shared across all themes */');
  cssLines.push('  /* These foundational values never change between themes */');
  
  // Add typography tokens - these are typically theme-agnostic
  if (typography) {
    cssLines.push('');
    cssLines.push('  /* Typography tokens - theme-agnostic */');
    const mode = typography.modes['Mode 1'];
    processTypography(mode);
  }
  
  // Add base color tokens
  if (foundations && foundations.modes.Light && foundations.modes.Light.global) {
    const globalTokens = foundations.modes.Light.global;
    processBaseTokens(globalTokens);
  }
  
  cssLines.push('}');
  
  // Process Light Theme
  if (foundations && foundations.modes.Light) {
    cssLines.push('');
    cssLines.push('/* Light theme tokens */');
    cssLines.push('.light-theme {');
    processThemeTokens(foundations.modes.Light, 'light');
    cssLines.push('}');
  }
  
  // Process Dark Theme
  if (foundations && foundations.modes.Dark) {
    cssLines.push('');
    cssLines.push('/* Dark theme tokens */');
    cssLines.push('.dark-theme {');
    processThemeTokens(foundations.modes.Dark, 'dark');
    cssLines.push('}');
  }
  
  // Add utility classes and theme toggle helper
  cssLines.push('');
  cssLines.push('/* Apply one of these classes to your html or body element */');
  cssLines.push('html, body {');
  cssLines.push('  /* Default to light theme */');
  cssLines.push('  color-scheme: light;');
  cssLines.push('}');
  cssLines.push('');
  cssLines.push('.dark-theme {');
  cssLines.push('  color-scheme: dark;');
  cssLines.push('}');
  cssLines.push('');
  cssLines.push('/* Theme-specific display control */');
  cssLines.push('.light-theme .dark-only { display: none !important; }');
  cssLines.push('.dark-theme .light-only { display: none !important; }');
  cssLines.push('');
  cssLines.push('/* Media query for system preference - automatically applies theme */');
  cssLines.push('@media (prefers-color-scheme: dark) {');
  cssLines.push('  html:not(.light-theme), body:not(.light-theme) {');
  cssLines.push('    color-scheme: dark;');
  cssLines.push('  }');
  cssLines.push('  ');
  cssLines.push('  html:not(.light-theme), body:not(.light-theme) {');
  cssLines.push('    /* Auto-apply dark theme if no theme class is specified */');
  cssLines.push('    --auto-theme: "dark";');
  cssLines.push('  }');
  cssLines.push('}');
}

// Process base tokens that don't change between themes
function processBaseTokens(globalTokens) {
  cssLines.push('');
  cssLines.push('  /* Base spacing tokens */');
  processBaseCategory(globalTokens.spacing, 'spacing');
  
  cssLines.push('');
  cssLines.push('  /* Base radius tokens */');
  processBaseCategory(globalTokens.radius, 'radius');
  
  cssLines.push('');
  cssLines.push('  /* Base container tokens */');
  processBaseCategory(globalTokens.container, 'container');
  
  // You can add more shared tokens here if needed
}

// Process a category of base tokens
function processBaseCategory(category, prefix) {
  if (!category) return;
  
  for (const key in category) {
    // Skip metadata properties
    if (key.startsWith('$')) continue;
    
    const token = category[key];
    
    if (token && typeof token === 'object' && !Array.isArray(token)) {
      if (token.$value !== undefined) {
        // This is a token with a value
        const variableName = kebabCase(`${prefix}-${key}`);
        const cssValue = getRawValue(token);
        
        cssLines.push(`  --${variableName}: ${cssValue};`);
        variableMap.set(variableName, cssValue);
      }
    }
  }
}

// Process theme-specific tokens
function processThemeTokens(mode, themeName) {
  currentProcessingMode = themeName;
  
  // Add color primitives first
  if (mode.global) {
    cssLines.push('  /* Color primitives */');
    processThemeColors(mode.global);
  }
  
  // Process semantic tokens
  if (mode.semantic) {
    cssLines.push('');
    cssLines.push('  /* Semantic tokens */');
    
    for (const category in mode.semantic) {
      if (category.startsWith('$')) continue;
      
      const categoryTokens = mode.semantic[category];
      
      cssLines.push('');
      cssLines.push(`  /* ${category} tokens */`);
      
      for (const key in categoryTokens) {
        if (key.startsWith('$')) continue;
        
        const token = categoryTokens[key];
        
        if (token && token.$value !== undefined) {
          const tokenName = `--${kebabCase(`${category}-${key}`)}`;
          const cssValue = getCssValue(token);
          
          cssLines.push(`  ${tokenName}: ${cssValue};`);
        }
      }
    }
  }
  
  // Process other theme-specific properties
  for (const key in mode) {
    if (key !== 'semantic' && key !== 'global' && !key.startsWith('$')) {
      const categoryTokens = mode[key];
      
      if (key === 'spacing' || key === 'radius' || key === 'container') {
        // Skip the base tokens that are already in :root
        continue;
      }
      
      cssLines.push('');
      cssLines.push(`  /* ${key} tokens */`);
      
      for (const tokenKey in categoryTokens) {
        if (tokenKey.startsWith('$')) continue;
        
        const token = categoryTokens[tokenKey];
        
        if (token && token.$value !== undefined) {
          const tokenName = `--${kebabCase(`${key}-${tokenKey}`)}`;
          const cssValue = getCssValue(token);
          
          cssLines.push(`  ${tokenName}: ${cssValue};`);
        }
      }
    }
  }
}

// Process theme-specific color tokens
function processThemeColors(global) {
  if (!global) return;
  
  for (const category in global) {
    if (category === 'spacing' || category === 'radius' || category === 'container') {
      // Skip the base tokens that are already in :root
      continue;
    }
    
    if (category.startsWith('$')) continue;
    
    const categoryTokens = global[category];
    
    cssLines.push('');
    cssLines.push(`  /* ${category} colors */`);
    
    for (const key in categoryTokens) {
      if (key.startsWith('$')) continue;
      
      const token = categoryTokens[key];
      
      if (token && token.$value !== undefined) {
        const variableName = kebabCase(`${category}-${key}`);
        const cssValue = getRawValue(token);
        
        cssLines.push(`  --${variableName}: ${cssValue};`);
      } else if (token && typeof token === 'object' && !Array.isArray(token)) {
        // This is a nested category (like brand.primary)
        for (const subKey in token) {
          if (subKey.startsWith('$')) continue;
          
          const subToken = token[subKey];
          
          if (subToken && subToken.$value !== undefined) {
            const variableName = kebabCase(`${category}-${key}-${subKey}`);
            const cssValue = getRawValue(subToken);
            
            cssLines.push(`  --${variableName}: ${cssValue};`);
          }
        }
      }
    }
  }
}

// Process typography tokens
function processTypography(typography) {
  for (const categoryKey in typography) {
    if (categoryKey.startsWith('$')) continue;
    
    const category = typography[categoryKey];
    cssLines.push('');
    cssLines.push(`  /* Typography - ${categoryKey} */`);
    
    for (const propertyKey in category) {
      if (propertyKey.startsWith('$')) continue;
      
      const property = category[propertyKey];
      
      if (property && property.$value !== undefined) {
        const variableName = kebabCase(`typography-${categoryKey}-${propertyKey}`);
        const cssValue = getRawValue(property);
        
        // For font family and font style values, remove quotes if needed
        let finalValue = cssValue;
        if (categoryKey === 'font family' || categoryKey === 'font weight') {
          finalValue = cssValue.replace(/['"]/g, '');
        }
        
        cssLines.push(`  --${variableName}: ${finalValue};`);
        variableMap.set(variableName, finalValue);
      }
    }
  }
}

// Get the raw value of a token (without variable references)
function getRawValue(token) {
  if (!token || token.$value === undefined) return 'inherit';
  
  const value = token.$value;
  const type = token.$type;
  
  // Handle different value types
  switch (type) {
    case 'color':
      return value;
    case 'float':
      return `${value}px`;
    case 'string':
      return `${value}`;
    default:
      return value;
  }
}

// Keep track of the current mode being processed
let currentProcessingMode = 'light';

function getCurrentMode() {
  return currentProcessingMode;
}

// Convert token value to CSS value with variable references
function getCssValue(token) {
  if (!token || token.$value === undefined) return 'inherit';
  
  const value = token.$value;
  const type = token.$type;
  
  // Handle references to other tokens
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    const reference = value.slice(1, -1); // Remove brackets
    return resolveReference(reference);
  }
  
  // For non-reference values, return the raw value
  return getRawValue(token);
}

// Resolve a token reference to a CSS variable
function resolveReference(reference) {
  const parts = reference.split('.');
  
  // Handle different types of references
  if (parts[0] === 'semantic') {
    // References to semantic tokens within the current theme
    return `var(--${parts.join('-')})`;
  } else if (parts[0] === 'global') {
    // References to global tokens within the current theme
    if (parts[1] === 'spacing' || parts[1] === 'radius' || parts[1] === 'container') {
      // These are in the :root
      return `var(--${parts.slice(1).join('-').toLowerCase()})`;
    } else {
      // Theme-specific colors
      return `var(--${parts.slice(1).join('-').toLowerCase()})`;
    }
  } else if (parts[0] === 'color') {
    // Handle color.brand structure
    return `var(--${parts.join('-')})`;
  } else {
    // Other references
    return `var(--${parts.join('-').toLowerCase()})`;
  }
}

// Convert a string to kebab-case
function kebabCase(str) {
  return str
    .replace(/\./g, '-')  // Replace dots with hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Convert camelCase to kebab-case
    .toLowerCase();
}

// Execute the script
processTokens();

// Write the CSS to file
const cssContent = cssLines.join('\n');
writeFileSync(outputFile, cssContent);

console.log(`Design tokens CSS generated successfully in ${outputFile}`); 
