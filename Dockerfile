FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN go build -o devdash-app .

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/devdash-app .

EXPOSE 8080

CMD ["./devdash-app"]