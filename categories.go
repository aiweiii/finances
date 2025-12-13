package main

import (
	"bufio"
	"log"
	"os"
	"path/filepath"
	"strings"
)

func MapMerchantToCategory() map[string]string {
	folder := "categories"
	entries, err := os.ReadDir(folder)
	if err != nil {
		log.Fatal("Cannot read directory", err)
	}

	merchantToCategory := make(map[string]string)

	for _, entry := range entries {
		fileName := entry.Name()
		fullPath := filepath.Join(folder, fileName)

		file, err := os.Open(fullPath)
		if err != nil {
			log.Println("Cannot open file %w", fileName)
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			merchant := strings.ToUpper(strings.TrimSpace(scanner.Text()))
			if merchant != "" {
				merchantToCategory[merchant] = fileName
			}
		}
	}
	return merchantToCategory
}