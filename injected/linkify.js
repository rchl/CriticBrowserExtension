'use strict';

/**
 * Linkifies all text nodes matching text of the links found in the document.
 */
class Linkify {
  static run() {
    let apiRoot = document.querySelector('.main');
    let tocLinks = apiRoot.querySelectorAll('a');
    // Create a text=>href map of links.
    let nameLinkMap = new Map();
    let regexEscape = /[\-\[\]{}()*+?.\\\^$|#]/g;
    let escapedKeys = [];
    Array.from(tocLinks).forEach(link => {
      let text = link.textContent;
      nameLinkMap.set(text, link.href);
      // Escape all texts so that they can be used safely in a regexp.
      escapedKeys.push(text.replace(regexEscape, '\\$&'));
    });
    // Create regexp covering all found link texts.
    let linksRegEx =
        new RegExp('\\b(' + Array.from(escapedKeys).join('|') + ')\\b', 'g');
    // Get all the text nodes from the document.
    let elementsToLinkify = apiRoot.querySelectorAll('.pre');
    let allTextNodes = [];
    Array.from(elementsToLinkify).forEach(element => {
      let nodeIterator =
          document.createNodeIterator(element, NodeFilter.SHOW_TEXT, {
            'acceptNode': node => {
              if (node.parentNode.nodeName === 'A') {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          });
      let walkedNode;
      while (walkedNode = nodeIterator.nextNode()) {
        allTextNodes.push(walkedNode);
      }
    });
    // Find indexes where we should start replacing in text nodes.
    for (let node of allTextNodes) {
      // An array of {index, length} objects.
      let matchIndex = [];
      let match;
      while ((match = linksRegEx.exec(node.data)) !== null) {
        matchIndex.push({
          'index': match.index,
          'length': linksRegEx.lastIndex - match.index
        });
      }
      if (matchIndex.length) {
        // Iterate backwards as text node length will change during replace.
        for (let i = matchIndex.length - 1; i >= 0; --i) {
          let matchInfo = matchIndex[i];
          let linkTextNode = node.splitText(matchInfo.index);
          let suffixNode = linkTextNode.splitText(matchInfo.length);
          let link = document.createElement('a');
          link.href = nameLinkMap.get(linkTextNode.data);
          link.appendChild(linkTextNode);
          suffixNode.parentNode.insertBefore(link, suffixNode);
        }
      }
    }
  }
};

Linkify.run();
