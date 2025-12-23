package main

import (
	"bufio"
	"database/sql"
	"log"
	"os"
	"strconv"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

func MustSetup() {
	db, err := sql.Open("mysql", "admin:admin@tcp(localhost:3306)/finance?parseTime=true")
	if err != nil {
		log.Fatalf("Error opening database: %v", err)
	}
	defer db.Close()

	// Drop table first (to ensure a fresh start)
	_, err = db.Exec(`DROP TABLE IF EXISTS expenses`)
	if err != nil {
		log.Fatalf("Error dropping table: %v", err)
	}

	// Create a fresh table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS expenses (
	    datetime DATETIME,
	    category TEXT,
	    merchant TEXT,
	    amount REAL
	)`)
	if err != nil {
		log.Fatalf("Error creating table: %v", err)
	}

	file, err := os.Open(OutputFilename)
	if err != nil {
		log.Fatalf("Error opening output file '%s': %v", OutputFilename, err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Scan() // skip header

	txn, err := db.Begin()
	if err != nil {
		log.Fatalf("Error starting sql transaction: %v", err)
	}

	stmt, err := txn.Prepare("INSERT INTO expenses (datetime, category, merchant, amount) VALUES (?, ?, ?, ?)")
	if err != nil {
		log.Fatalf("Error preparing statement: %v", err)
	}

	for scanner.Scan() {
		fields := strings.Split(scanner.Text(), "\t")
		amount, _ := strconv.ParseFloat(fields[3], 64)
		stmt.Exec(fields[0], fields[1], fields[2], amount)
	}

	stmt.Close()
	txn.Commit()
}
