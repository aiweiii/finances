package app

type TrieNode struct {
	Children  map[string]*TrieNode // a node points to other nodes
	EndOfWord bool
}

type Trie struct {
	Root *TrieNode
}

func NewTrie() *Trie {
	return &Trie{
		Root: &TrieNode{
			Children: make(map[string]*TrieNode),
		},
	}
}

func (t *Trie) Insert(word string) {
	curr := t.Root

	for _, ru := range word {
		char := string(ru)

		// if char is a key in children, trace down that child
		// else create a new key from curr
		_, ok := curr.Children[char]
		if !ok {
			curr.Children[char] = &TrieNode{
				Children: make(map[string]*TrieNode),
			}
		}
		curr = curr.Children[char]
	}

	// after looping through all chars in word, mark end-of-word
	curr.EndOfWord = true
}

func (t *Trie) Search(word string) bool {
	curr := t.Root

	for _, ru := range word {
		char := string(ru)

		_, ok := curr.Children[char]
		if !ok {
			return false
		}
		curr = curr.Children[char]
	}

	return curr.EndOfWord
}

func (t *Trie) StartsWith(word string) bool {
	curr := t.Root

	for _, ru := range word {
		char := string(ru)

		_, ok := curr.Children[char]
		if !ok {
			return false
		}
		curr = curr.Children[char]
	}

	return true
}
