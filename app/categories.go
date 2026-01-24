package app

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func BuildTrieOnKnownMerchants() (*Trie, error) {
	folder := "categories"
	entries, err := os.ReadDir(folder)
	if err != nil {
		return nil, fmt.Errorf("error reading categories directory: %w", err)
	}

	t := NewTrie()

	for _, entry := range entries {
		fileName := entry.Name()
		fullPath := filepath.Join(folder, fileName)

		file, err := os.Open(fullPath)
		if err != nil {
			return nil, fmt.Errorf("error opening file under categories: %w", err)
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			merchant := strings.ToUpper(strings.TrimSpace(scanner.Text()))
			if merchant != "" {
				t.Insert(merchant, fileName)
			}
		}
	}

	return t, nil
}
