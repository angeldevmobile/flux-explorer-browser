// ============================================================
//  DOM — Arena allocator basado en Vec<Node>
//
//  Decisiones de diseño:
//  - Vec<Node> flat: todos los nodos en un bloque contiguo de memoria
//    → cache-friendly, sin fragmentación del heap
//  - NodeId = usize wrapeado en newtype: seguro, sin punteros colgantes
//  - Hijos = Vec<NodeId>: sin Rc/Arc/Box, sin double-indirection
//  - &'a str: todos los strings son slices del HTML original → 0 copias
//  - Atributos = Vec<(&str, &str)>: simple y zero-copy
//
//  Complejidad:
//  - arena.get(id)    → O(1)
//  - append_child     → O(1) amortizado
//  - Memoria total    = sizeof(Node) × n_nodos (sin overhead por nodo)
// ============================================================

/// Índice en el arena. Tipo newtype para evitar mezclar usize.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct NodeId(pub usize);

/// Datos de un nodo DOM. Enum liviano — sin heap en variantes comunes.
#[derive(Debug)]
pub enum NodeData<'a> {
    /// Raíz virtual del documento
    Document,
    /// Elemento HTML: <tag attr="val">
    Element {
        tag:   &'a str,
        attrs: Vec<(&'a str, &'a str)>,
    },
    /// Nodo de texto
    Text(&'a str),
}

/// Un nodo en el arena.
/// Tamaño fijo -> Vec<Node> es cache-friendly.
#[derive(Debug)]
pub struct Node<'a> {
    pub data:     NodeData<'a>,
    pub parent:   Option<NodeId>,
    pub children: Vec<NodeId>,
}

/// Arena allocator: todos los nodos en un Vec contiguo.
#[derive(Debug)]
pub struct Arena<'a> {
    nodes: Vec<Node<'a>>,
}

impl<'a> Arena<'a> {
    /// Crea un arena vacío con capacidad pre-asignada.
    pub fn new() -> Self {
        Arena {
            nodes: Vec::with_capacity(128),
        }
    }

    /// Inserta un nuevo nodo y retorna su id.
    pub fn create_node(&mut self, data: NodeData<'a>) -> NodeId {
        let id = NodeId(self.nodes.len());
        self.nodes.push(Node { data, parent: None, children: Vec::new() });
        id
    }

    /// Añade `child` como hijo de `parent`.
    pub fn append_child(&mut self, parent: NodeId, child: NodeId) {
        self.nodes[child.0].parent = Some(parent);
        self.nodes[parent.0].children.push(child);
    }

    /// Acceso inmutable a un nodo.
    #[inline]
    pub fn get(&self, id: NodeId) -> &Node<'a> {
        &self.nodes[id.0]
    }

    /// Raíz del documento (siempre NodeId(0)).
    #[inline]
    pub fn root(&self) -> NodeId {
        NodeId(0)
    }

    /// Total de nodos en el árbol.
    #[inline]
    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    /// Itera sobre todos los nodos en orden de inserción.
    pub fn iter(&self) -> impl Iterator<Item = (NodeId, &Node<'a>)> {
        self.nodes.iter().enumerate().map(|(i, n)| (NodeId(i), n))
    }

    /// Devuelve el valor de un atributo de un nodo elemento.
    pub fn attr(&self, id: NodeId, name: &str) -> Option<&str> {
        match &self.get(id).data {
            NodeData::Element { attrs, .. } => {
                attrs.iter().find(|(k, _)| *k == name).map(|(_, v)| *v)
            }
            _ => None,
        }
    }
}

impl<'a> Default for Arena<'a> {
    fn default() -> Self { Self::new() }
}
