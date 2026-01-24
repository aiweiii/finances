package app

import "strings"

type TrieNode struct {
	Children  map[string]*TrieNode // a node points to other nodes
	EndOfWord bool
	Category  string
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

// Insert inserts uppercased word into trie and tags the EndOfWord with category
func (t *Trie) Insert(word string, category string) {
	curr := t.Root
	word = strings.Join(strings.Fields(word), "")

	for _, ru := range word {
		char := strings.ToUpper(string(ru))

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
	curr.Category = category
}

func (t *Trie) MatchLongestCategory(word string) string {
	curr := t.Root
	word = strings.Join(strings.Fields(word), "")

	for _, ru := range word {
		char := strings.ToUpper(string(ru))

		_, ok := curr.Children[char]
		if !ok {
			return curr.Category
		}
		curr = curr.Children[char]
	}

	return curr.Category
}

// func (t *Trie) Search(word string) bool {
// 	curr := t.Root
//
// 	for _, ru := range word {
// 		char := string(ru)
//
// 		_, ok := curr.Children[char]
// 		if !ok {
// 			return false
// 		}
// 		curr = curr.Children[char]
// 	}
//
// 	return curr.EndOfWord
// }
//
// func (t *Trie) StartsWith(word string) bool {
// 	curr := t.Root
//
// 	for _, ru := range word {
// 		char := string(ru)
//
// 		_, ok := curr.Children[char]
// 		if !ok {
// 			return false
// 		}
// 		curr = curr.Children[char]
// 	}
//
// 	return true
// }
