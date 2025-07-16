import { Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    header: {
      setHeaderContent: (content: string) => ReturnType;
    };
  }
}

export const HeaderNode = Node.create({
  name: 'header',
  group: 'pageStructure',
  content: 'block+',
  defining: true,
  isolated: true,

  parseHTML() {
    return [{ tag: 'div[data-type="header"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // This node is a data container and is not rendered in the main document flow.
    return ['div', { ...HTMLAttributes, 'data-type': 'header', style: 'display: none;' }, 0];
  },


  addCommands() {
    return {
      setHeaderContent:
        (content: string) =>
        ({ tr, state, dispatch, editor }) => {
          if (!dispatch) return false;
          
          const { schema } = state;
          const headerNodeType = schema.nodes.header;
          
          // Create a paragraph with the content
          const paragraph = schema.nodes.paragraph.create({}, content ? schema.text(content) : null);
          const newNode = headerNodeType.create({}, paragraph);
  
          // If first node is header, replace it, else insert at pos 0
          if (state.doc.firstChild?.type === headerNodeType) {
            tr.replaceWith(0, state.doc.firstChild.nodeSize, newNode);
          } else {
            tr.insert(0, newNode);
          }
          
          // Add meta to trigger pagination update
          tr.setMeta('HEADER_FOOTER_UPDATE_META_KEY', Date.now());
  
          dispatch(tr);
          return true;
        },
    };
  }
});

