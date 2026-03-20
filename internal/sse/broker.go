package sse

import (
	"fmt"
	"sync"
)

type Broker struct {
	clients    map[chan []byte]struct{}
	mu         sync.RWMutex
	register   chan chan []byte
	unregister chan chan []byte
}

func NewBroker() *Broker {
	return &Broker{
		clients:    make(map[chan []byte]struct{}),
		register:   make(chan chan []byte),
		unregister: make(chan chan []byte),
	}
}

func (b *Broker) Start() {
	for {
		select {
		case ch := <-b.register:
			b.mu.Lock()
			b.clients[ch] = struct{}{}
			b.mu.Unlock()
		case ch := <-b.unregister:
			b.mu.Lock()
			delete(b.clients, ch)
			close(ch)
			b.mu.Unlock()
		}
	}
}

func (b *Broker) Subscribe() chan []byte {
	ch := make(chan []byte, 64)
	b.register <- ch
	return ch
}

func (b *Broker) Unsubscribe(ch chan []byte) {
	b.unregister <- ch
}

func (b *Broker) Publish(event string, data []byte) {
	msg := []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", event, data))
	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.clients {
		select {
		case ch <- msg:
		default:
		}
	}
}
