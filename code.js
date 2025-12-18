figma.showUI(__html__, { width: 340, height: 400 });

figma.ui.onmessage = async (msg) => {

  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
  }

  if (msg.type === 'apply-text') {
    
    let notificationHandler = null;

    try {
      // 1. Select Layers
      const selection = figma.currentPage.selection;
      const textNodes = selection.filter(node => node.type === "TEXT");

      if (textNodes.length === 0) {
        figma.notify("❌ Please select at least one Text layer.");
        return;
      }

      // 2. Parse List (Optional now)
      // If the user entered text, we parse it. If not, textList stays empty.
      let textList = [];
      
      if (msg.textList && msg.textList.trim().length > 0) {
        let rawList = [];
        if (msg.separator === 'space') {
          rawList = msg.textList.trim().split(/\s+/);
        } else if (msg.separator === 'newline') {
          rawList = msg.textList.trim().split(/\r?\n/);
        } else {
          rawList = msg.textList.split(','); // default comma
        }
        textList = rawList.map(t => t.trim()).filter(t => t.length > 0);
      }

      // 3. Validation
      // We need EITHER a text list OR (prefix/suffix/casing change) to proceed.
      const hasTextList = textList.length > 0;
      const hasPrefix = msg.prefix && msg.prefix.length > 0;
      const hasSuffix = msg.suffix && msg.suffix.length > 0;
      const hasCasing = msg.casing && msg.casing !== 'original';

      if (!hasTextList && !hasPrefix && !hasSuffix && !hasCasing) {
        figma.notify("❌ Enter text to replace, or add a Prefix/Suffix to update existing text.");
        return;
      }

      notificationHandler = figma.notify(`Updating ${textNodes.length} layers...`, { timeout: Infinity });

      // 4. Load Fonts & Apply
      let updatedCount = 0;
      let errorCount = 0;
      const loadedFonts = new Set();

      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];

        try {
          // Load Font
          let fontName = node.fontName;
          if (fontName === figma.mixed) {
             if (node.characters.length > 0) fontName = node.getRangeFontName(0, 1);
             else continue;
          }

          const fontKey = `${fontName.family}-${fontName.style}`;
          if (!loadedFonts.has(fontKey)) {
            await figma.loadFontAsync(fontName);
            loadedFonts.add(fontKey);
          }

          // Determine Base Text
          let baseText = "";
          
          if (hasTextList) {
            // SCENARIO A: User provided a list -> Overwrite existing text
            if (msg.mode === 'random') {
              baseText = textList[Math.floor(Math.random() * textList.length)];
            } else {
              baseText = textList[i % textList.length];
            }
          } else {
            // SCENARIO B: No list provided -> Use existing text (Append Mode)
            baseText = node.characters;
          }

          // Apply Casing
          const casedText = applyCasing(baseText, msg.casing);
          
          // Apply Prefix & Suffix
          const prefix = msg.prefix || "";
          const suffix = msg.suffix || ""; 
          
          const finalText = `${prefix}${casedText}${suffix}`;

          node.characters = finalText;
          updatedCount++;

        } catch (innerError) {
          console.error(`Error on layer "${node.name}":`, innerError);
          errorCount++;
        }
      }

      if (notificationHandler) notificationHandler.cancel();

      if (errorCount > 0) {
        figma.notify(`✅ Updated ${updatedCount}. (Skipped ${errorCount} errors)`);
      } else {
        figma.notify(`✅ Updated ${updatedCount} layers!`);
      }

    } catch (error) {
      if (notificationHandler) notificationHandler.cancel();
      console.error(error);
      figma.notify("❌ An error occurred. Check console for details.");
    }
  }
};

// --- HELPER: Casing Logic ---
function applyCasing(text, type) {
  if (!text) return "";
  switch (type) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title': 
      // Simple Title Case: Capitalize first letter of every word
      return text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    case 'original': 
    default: 
      return text;
  }
}
