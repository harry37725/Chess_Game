        </Card>

        <details className="p-4 flex flex-col h-80" open>
          <summary className="cursor-pointer font-semibold mb-2 text-sm">Chat</summary>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-2">
              {chat.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className={cn(
                    "font-medium",
                    m.from === "System" ? "text-primary" :
                    m.from === "AI" ? "text-chart-2" :
                    m.from.includes("(spectator)") ? "text-chart-3" : "text-foreground"
                  )}>{m.from}:</span>{" "}
                  <span className="text-muted-foreground">{m.text}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
              placeholder="Say something…"
            />
            <Button size="icon" onClick={sendChat}><Send className="h-4 w-4" /></But
        </details>
