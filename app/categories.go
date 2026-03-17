package app

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func BuildTrieOnKnownMerchants() (*Trie, []string, error) {
	folder := "categories"
	entries, err := os.ReadDir(folder)
	if err != nil {
		return nil, nil, fmt.Errorf("error reading categories directory: %w", err)
	}

	t := NewTrie()
	var categoryNames []string

	for _, entry := range entries {
		fileName := entry.Name()
		if strings.HasPrefix(fileName, ".") {
			continue
		}
		fullPath := filepath.Join(folder, fileName)
		categoryNames = append(categoryNames, fileName)

		file, err := os.Open(fullPath)
		if err != nil {
			return nil, nil, fmt.Errorf("error opening file under categories: %w", err)
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

	return t, categoryNames, nil
}
