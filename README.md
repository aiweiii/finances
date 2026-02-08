## About
This project is a work in progress.

This is a finance tracking web application. It takes in a PDF, reads the transactions into a structured CSV file, categorises and stores them into a database.
There is no UI at the moment, iterations are done to first stabilise backend operations.

## Background
This project exists because, to my best knowledge, there are no applications that could let me reliably track all of my
combined expenses (from different banks, transactions from both deposit/credit accounts etc.). 
There was one but that bank revoked the API soon after.

I've been tracking my finances since I was in school. I'm not obsessed-but obsessed enough to want to automate this.
Now that I've started working, I find it hard to keep up with manual entries (though arguably, I could be if I were disciplined enough-but I'm not).
So for now, I've decided to automate my laziness away as much as possible. Hence, this Project W here (I'll reserve the use of 'X' for something bigger).

## Caveats
- Currently, this application only supports bank statement from the following bank(s): United Overseas Bank (UOB).
  - The application is smart enough to process PDF (thanks to [Docling](https://docling-project.github.io/docling/concepts/architecture/)) but not smart enough to figure what's the real transaction we wanna capture from the PDF.
  - So this needs to be implemented separately, as demonstrated in `./preprocessor/statements/process.document.ipynb`.
  - Given there's <20 banks in Singapore, we need roughly 5 lines of code * 20 banks to make this application "smart enough" to sufficiently handle the majority use case.
- Currently, the app does not automatically categorise your spending.
  - You need to manually define categories under `./categories/` by creating files such as `food.txt`, `groceries.txt` or `travel.txt`.
  - Each file should contain a list of merchant names belonging to that category.
  - The app then uses trie-based matching to map a transaction’s merchant description to these categories.
  - E.g., if `AIRBNB` is listed in `travel.txt`, it will match all related transactions such as `AIRBNB * HMS922XSAR 653-163-1004 Ref No. : 51972375084209692168650` found in your bank statement.

## How to get started
(Honestly it's too much work at this point, so this is just for the curious cat ₍^. .^₎Ⳋ )
1. Clone this repository
2. Drop a bank statement (PDF) into `./preprocessor/statements/`
3. Rename the bank statement into `<bank>_<mmm>_<yyyy>.pdf`
4. Run `jupyter notebook` (note: I could convert this to just .py but .ipynb gives me better visualisation at this point)
   - Open `process_document.ipynb` and run the first cell. 
   - The output would appear under `./preprocessor/scratch/` as a CSV file. 
     Under Caveat point 1, we only want transactions that matter so you'd need to write your own logic in `./preprocessor/preocess_statement.py`
5. Once you're happy with your output CSV, navigate to the project root directory.
6. Run `docker compose up`
7. Run `go build`
8. Run `go run .`
9. Exec into mysql container to double check if your transactions are correctly populated into database.
   - `mysql -u localhost -u admin -p root`
   - `use finance;`
   - `select * from expenses;`
10. For now, I use grafana for visualisation as it's good enough to group by month and by category.
    - In your browser, navigate to `localhost:3000`.
    - Set up mysql connection (`sudo docker network inspect` might come in handy to get local ipv4)
    - If you're familiar with grafana, play around. If not, import `grafana.json` as an example.
11. [BONUS] If you want to categorise, follow Caveat point 2.

This project has a long way to go. Open to collaboration.