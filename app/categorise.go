package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var validCategories = []string{
	"food", "drinks", "travel", "transport", "groceries",
	"lifestyle", "subscriptions", "education", "investment",
	"insurance", "transfers", "misc",
}

// CategoriseWithAI sends a batch of merchant names to Ollama (local) and returns a map of merchant -> category.
func CategoriseWithAI(merchants []string) (map[string]string, error) {
	// Keep ordered list for mapping numbered responses back to merchant names
	orderedMerchants := merchants
	if len(merchants) == 0 {
		return map[string]string{}, nil
	}

	prompt := buildPrompt(merchants)

	body := map[string]interface{}{
		"model": "llama3.2:3b",
		"messages": []map[string]string{
			{"role": "system", "content": "You are a financial transaction categoriser. Respond with ONLY valid JSON, no markdown, no explanation."},
			{"role": "user", "content": prompt},
		},
		"stream":      false,
		"temperature": 0.1,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("error marshalling request: %w", err)
	}

	var respBody []byte
	for attempt := 0; attempt < 3; attempt++ {
		resp, err := http.Post("http://localhost:11434/api/chat", "application/json", bytes.NewReader(jsonBody))
		if err != nil {
			if attempt < 2 {
				wait := time.Duration(2<<attempt) * time.Second
				fmt.Printf("  Ollama not ready, retrying in %v ...\n", wait)
				time.Sleep(wait)
				continue
			}
			return nil, fmt.Errorf("error calling Ollama: %w (is `ollama serve` running?)", err)
		}

		respBody, err = io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("error reading response: %w", err)
		}

		if resp.StatusCode != 200 {
			return nil, fmt.Errorf("Ollama returned status %d: %s", resp.StatusCode, string(respBody))
		}

		return parseResponse(respBody, orderedMerchants)
	}

	return nil, fmt.Errorf("Ollama failed after 3 retries")
}

func buildPrompt(merchants []string) string {
	merchantList := ""
	for i, m := range merchants {
		merchantList += fmt.Sprintf("%d. %s\n", i+1, m)
	}

	return fmt.Sprintf(`Given a list of merchant names from Singapore bank statements, classify each into exactly one category.

Categories: %s

Rules:
- "drinks" = bubble tea, coffee chains, tea brands (e.g. KOI, Chagee, Starbucks, Old Tea Hut, Mr Coconut)
- "food" = restaurants, hawker stalls, bakeries, fast food
- "travel" = flights, hotels, car rental, travel bookings, travel insurance
- "transport" = MRT, bus, taxi, Grab
- "transfers" = personal fund transfers (PayNow, FAST), bill payments to credit cards
- "investment" = brokerage (IBKR), CPF voluntary contributions, Wise transfers for investment
- "insurance" = insurance premiums
- "subscriptions" = recurring digital services (Spotify, Netflix, etc.)
- "lifestyle" = shopping, beauty, personal care
- "groceries" = supermarkets (NTUC, Cold Storage)
- "education" = courses, training
- "misc" = anything that doesn't clearly fit

Respond with ONLY a JSON object where the keys are the merchant numbers (as strings like "1", "2", etc.) and values are the category. No explanation, no markdown, just the raw JSON object.

Example response format: {"1": "food", "2": "travel", "3": "misc"}

Merchants:
%s`, strings.Join(validCategories, ", "), merchantList)
}

func parseResponse(respBody []byte, merchants []string) (map[string]string, error) {
	var ollamaResp struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}

	if err := json.Unmarshal(respBody, &ollamaResp); err != nil {
		return nil, fmt.Errorf("error parsing Ollama response: %w", err)
	}

	text := ollamaResp.Message.Content
	// Strip markdown code fences if present
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	// Parse numbered keys ("1", "2", ...) and map back to merchant names
	numbered := map[string]string{}
	if err := json.Unmarshal([]byte(text), &numbered); err != nil {
		return nil, fmt.Errorf("error parsing JSON output: %w\nraw text: %s", err, text)
	}

	validSet := map[string]bool{}
	for _, c := range validCategories {
		validSet[c] = true
	}

	result := map[string]string{}
	for numStr, cat := range numbered {
		idx := 0
		fmt.Sscanf(numStr, "%d", &idx)
		if idx >= 1 && idx <= len(merchants) {
			if !validSet[cat] {
				cat = "misc"
			}
			result[merchants[idx-1]] = cat
		}
	}

	return result, nil
}
