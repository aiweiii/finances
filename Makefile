.PHONY: preprocess test pt run_stg frontend

preprocess:
	python3 preprocessor/process_document.py

test:
	pytest preprocessor/test.py -v

pt: preprocess test

run_stg:
	go run . stg

frontend:
	cd frontend && npm run dev

all: pt run_stg frontend