import { CommandProps, Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footer: {
      setFooterContent: (content: string) => ReturnType;
    };
  }
}

export const FooterNode = Node.create({
    name: 'footer',
    group: 'pageStructure',
    content: 'block+',
    defining: true,
    isolated: true,
  
    parseHTML() {
      return [{ tag: 'div[data-type="footer"]' }];
    },
  
    renderHTML({ HTMLAttributes }) {
      // This node itself is not rendered visually in the main document flow
      // It only serves as a container for the master content.
      return ['div', { ...HTMLAttributes, 'data-type': 'footer', style: 'display: none;' }, 0];
    },

    addCommands() {
      return {
        setFooterContent:
          (content: string) =>
          ({ tr, state, dispatch } : CommandProps) => {
            if (!dispatch) return false;
            
            const { schema } = state;
            const footerNodeType = schema.nodes.footer;
            
            // Create a paragraph with the content
            const paragraph = schema.nodes.paragraph.create({}, content ? schema.text(content) : null);
            const newNode = footerNodeType.create({}, paragraph);
    
            // If last node is footer, replace it, else insert at end
            if (state.doc.lastChild?.type === footerNodeType) {
              const lastNodePos = state.doc.content.size - state.doc.lastChild.nodeSize;
              tr.replaceWith(lastNodePos, state.doc.content.size, newNode);
            } else {
              tr.insert(state.doc.content.size, newNode);
            }
            
            // Add meta to trigger pagination update
            tr.setMeta('HEADER_FOOTER_UPDATE_META_KEY', Date.now());
    
            dispatch(tr);
            return true;
          },
      };
    }
  });