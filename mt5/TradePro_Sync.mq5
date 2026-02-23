//+------------------------------------------------------------------+
//|                                              TradePro_Sync.mq5   |
//|                        Copyright 2024, TradePro Platform          |
//|                                     https://tradepro.app          |
//+------------------------------------------------------------------+
#property copyright "TradePro Platform"
#property link      "https://tradepro.app"
#property version   "1.00"
#property description "Automatic MT5 trade sync to TradePro dashboard"
#property strict

//--- Input parameters
input string   ApiKey       = "";                                    // API Key (from TradePro dashboard)
input string   WebhookUrl   = "http://localhost:3000";              // Backend URL
input int      HeartbeatSec = 30;                                   // Heartbeat interval (seconds)
input int      MaxRetries   = 3;                                    // Max retry attempts
input int      RetryDelayMs = 2000;                                 // Retry delay (ms)

//--- Global variables
int            lastProcessedTicket = 0;
datetime       lastHeartbeat       = 0;
string         headers             = "";

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(ApiKey) == 0)
   {
      Print("ERROR: API Key is not set. Please configure the ApiKey input.");
      return INIT_PARAMETERS_INCORRECT;
   }
   
   if(StringLen(WebhookUrl) == 0)
   {
      Print("ERROR: Webhook URL is not set.");
      return INIT_PARAMETERS_INCORRECT;
   }
   
   // Set up authorization header
   headers = "Content-Type: application/json\r\nAuthorization: Bearer " + ApiKey;
   
   // Set timer for heartbeat
   EventSetTimer(HeartbeatSec);
   
   Print("TradePro Sync EA initialized successfully");
   Print("Webhook URL: ", WebhookUrl);
   Print("Heartbeat interval: ", IntegerToString(HeartbeatSec), "s");
   
   // Send initial heartbeat
   SendHeartbeat();
   
   // Process any existing closed trades on startup
   ProcessHistoricalTrades();
   
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("TradePro Sync EA removed. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Timer function — sends heartbeat                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   SendHeartbeat();
}

//+------------------------------------------------------------------+
//| Trade transaction handler                                         |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                         const MqlTradeRequest &request,
                         const MqlTradeResult &result)
{
   // We only care about deal additions (closed/partially closed trades)
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;
   
   // Small delay to ensure deal history is updated
   Sleep(500);
   
   ulong dealTicket = trans.deal;
   if(dealTicket == 0)
      return;
   
   // Select the deal from history
   if(!HistoryDealSelect(dealTicket))
   {
      Print("WARNING: Could not select deal ", dealTicket);
      return;
   }
   
   // Only process closing deals (DEAL_ENTRY_OUT or DEAL_ENTRY_INOUT)
   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT)
      return;
   
   // Get the position ticket to find the opening deal
   long positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   if(positionId == 0)
      return;
   
   // Get deal details  
   string symbol   = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   double lots     = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   double profit   = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
   double exitPx   = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   datetime closeT = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
   long magic      = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   string comment  = HistoryDealGetString(dealTicket, DEAL_COMMENT);
   
   // Determine side from deal type — closing deal type is opposite of position
   ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   string side = (dealType == DEAL_TYPE_SELL) ? "BUY" : "SELL"; // Inverse because it's closing
   
   // Find the opening deal to get entry price and open time
   double entryPx = 0;
   datetime openT = 0;
   double sl = 0;
   double tp = 0;
   
   if(HistorySelectByPosition(positionId))
   {
      int totalDeals = HistoryDealsTotal();
      for(int i = 0; i < totalDeals; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0) continue;
         
         ENUM_DEAL_ENTRY e = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket, DEAL_ENTRY);
         if(e == DEAL_ENTRY_IN)
         {
            entryPx = HistoryDealGetDouble(ticket, DEAL_PRICE);
            openT   = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
            sl      = HistoryDealGetDouble(ticket, DEAL_SL);
            tp      = HistoryDealGetDouble(ticket, DEAL_TP);
            break;
         }
      }
   }
   
   // Fallback if entry not found
   if(entryPx == 0) entryPx = exitPx;
   if(openT == 0) openT = closeT;
   
   // Normalize symbol
   string normSymbol = NormalizeSymbolName(symbol);
   
   // Build JSON payload
   string json = "{";
   json += "\"ticket\":" + IntegerToString(positionId) + ",";
   json += "\"symbol\":\"" + normSymbol + "\",";
   json += "\"side\":\"" + side + "\",";
   json += "\"entry\":" + DoubleToString(entryPx, 8) + ",";
   json += "\"exit\":" + DoubleToString(exitPx, 8) + ",";
   json += "\"sl\":" + DoubleToString(sl, 8) + ",";
   json += "\"tp\":" + DoubleToString(tp, 8) + ",";
   json += "\"lots\":" + DoubleToString(lots, 2) + ",";
   json += "\"profit\":" + DoubleToString(profit, 2) + ",";
   json += "\"open_time\":\"" + TimeToString(openT, TIME_DATE | TIME_SECONDS) + "\",";
   json += "\"close_time\":\"" + TimeToString(closeT, TIME_DATE | TIME_SECONDS) + "\",";
   json += "\"magic\":" + IntegerToString(magic) + ",";
   json += "\"comment\":\"" + EscapeJson(comment) + "\",";
   json += "\"account_login\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"server\":\"" + AccountInfoString(ACCOUNT_SERVER) + "\"";
   json += "}";
   
   // Send with retry
   bool success = SendWithRetry(WebhookUrl + "/api/mt5/trade", json);
   
   if(success)
      Print("✅ Trade synced: ", normSymbol, " ", side, " #", positionId, " P&L: ", DoubleToString(profit, 2));
   else
      Print("❌ Failed to sync trade #", positionId, " after ", MaxRetries, " attempts");
}

//+------------------------------------------------------------------+
//| Process historical closed trades on startup                       |
//+------------------------------------------------------------------+
void ProcessHistoricalTrades()
{
   // Look back 24 hours for any unsynced trades
   datetime from = TimeCurrent() - 86400;
   datetime to   = TimeCurrent();
   
   if(!HistorySelect(from, to))
      return;
   
   int totalDeals = HistoryDealsTotal();
   int synced = 0;
   
   for(int i = 0; i < totalDeals; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      
      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT)
         continue;
      
      long positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(positionId == 0) continue;
      
      string symbol  = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      double lots    = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
      double profit  = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
      double exitPx  = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      datetime closeT = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      long magic      = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
      string comment  = HistoryDealGetString(dealTicket, DEAL_COMMENT);
      
      ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      string side = (dealType == DEAL_TYPE_SELL) ? "BUY" : "SELL";
      
      double entryPx = 0;
      datetime openT = 0;
      double sl = 0, tp = 0;
      
      if(HistorySelectByPosition(positionId))
      {
         int total = HistoryDealsTotal();
         for(int j = 0; j < total; j++)
         {
            ulong t = HistoryDealGetTicket(j);
            if(t == 0) continue;
            ENUM_DEAL_ENTRY e = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(t, DEAL_ENTRY);
            if(e == DEAL_ENTRY_IN)
            {
               entryPx = HistoryDealGetDouble(t, DEAL_PRICE);
               openT   = (datetime)HistoryDealGetInteger(t, DEAL_TIME);
               sl      = HistoryDealGetDouble(t, DEAL_SL);
               tp      = HistoryDealGetDouble(t, DEAL_TP);
               break;
            }
         }
      }
      
      if(entryPx == 0) entryPx = exitPx;
      if(openT == 0) openT = closeT;
      
      string normSymbol = NormalizeSymbolName(symbol);
      
      string json = "{";
      json += "\"ticket\":" + IntegerToString(positionId) + ",";
      json += "\"symbol\":\"" + normSymbol + "\",";
      json += "\"side\":\"" + side + "\",";
      json += "\"entry\":" + DoubleToString(entryPx, 8) + ",";
      json += "\"exit\":" + DoubleToString(exitPx, 8) + ",";
      json += "\"sl\":" + DoubleToString(sl, 8) + ",";
      json += "\"tp\":" + DoubleToString(tp, 8) + ",";
      json += "\"lots\":" + DoubleToString(lots, 2) + ",";
      json += "\"profit\":" + DoubleToString(profit, 2) + ",";
      json += "\"open_time\":\"" + TimeToString(openT, TIME_DATE | TIME_SECONDS) + "\",";
      json += "\"close_time\":\"" + TimeToString(closeT, TIME_DATE | TIME_SECONDS) + "\",";
      json += "\"magic\":" + IntegerToString(magic) + ",";
      json += "\"comment\":\"" + EscapeJson(comment) + "\",";
      json += "\"account_login\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
      json += "\"server\":\"" + AccountInfoString(ACCOUNT_SERVER) + "\"";
      json += "}";
      
      if(SendWithRetry(WebhookUrl + "/api/mt5/trade", json))
         synced++;
      
      // Re-select full history range for next iteration
      HistorySelect(from, to);
   }
   
   if(synced > 0)
      Print("Historical sync: ", synced, " trades synced from last 24h");
}

//+------------------------------------------------------------------+
//| Send heartbeat with account info                                   |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string json = "{";
   json += "\"account_login\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"server\":\"" + AccountInfoString(ACCOUNT_SERVER) + "\",";
   json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2);
   json += "}";
   
   bool success = SendWithRetry(WebhookUrl + "/api/mt5/heartbeat", json);
   
   if(success)
      lastHeartbeat = TimeCurrent();
}

//+------------------------------------------------------------------+
//| HTTP POST with retry logic                                         |
//+------------------------------------------------------------------+
bool SendWithRetry(string url, string jsonBody)
{
   for(int attempt = 1; attempt <= MaxRetries; attempt++)
   {
      int timeout = 5000; // 5 second timeout
      char post[];
      char result[];
      string resultHeaders;
      
      StringToCharArray(jsonBody, post, 0, WHOLE_ARRAY, CP_UTF8);
      // Remove null terminator
      ArrayResize(post, ArraySize(post) - 1);
      
      ResetLastError();
      
      int res = WebRequest(
         "POST",
         url,
         headers,
         timeout,
         post,
         result,
         resultHeaders
      );
      
      if(res == 200)
         return true;
      
      int err = GetLastError();
      
      if(res == -1)
      {
         Print("WebRequest error (attempt ", attempt, "/", MaxRetries, "): ",
               err, " - Ensure URL is whitelisted in MT5 settings (Tools > Options > Expert Advisors)");
      }
      else
      {
         string responseBody = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
         Print("HTTP ", res, " (attempt ", attempt, "/", MaxRetries, "): ", responseBody);
         
         // Don't retry on 4xx client errors (except 429 rate limit)
         if(res >= 400 && res < 500 && res != 429)
            return false;
      }
      
      if(attempt < MaxRetries)
         Sleep(RetryDelayMs * attempt); // Exponential backoff
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Normalize symbol name (strip broker suffixes)                      |
//+------------------------------------------------------------------+
string NormalizeSymbolName(string raw)
{
   string symbol = raw;
   
   // Remove common broker suffixes
   string suffixes[] = {".pro", ".raw", ".ecn", ".std", ".micro", ".mini",
                         ".m", ".c", ".i", ".e", ".x", ".z", ".b", ".s"};
   
   for(int i = 0; i < ArraySize(suffixes); i++)
   {
      int pos = StringFind(symbol, suffixes[i]);
      if(pos > 0 && pos == StringLen(symbol) - StringLen(suffixes[i]))
      {
         symbol = StringSubstr(symbol, 0, pos);
         break;
      }
   }
   
   // Convert to uppercase
   StringToUpper(symbol);
   
   return symbol;
}

//+------------------------------------------------------------------+
//| Escape special characters for JSON strings                         |
//+------------------------------------------------------------------+
string EscapeJson(string input)
{
   string output = input;
   StringReplace(output, "\\", "\\\\");
   StringReplace(output, "\"", "\\\"");
   StringReplace(output, "\n", "\\n");
   StringReplace(output, "\r", "\\r");
   StringReplace(output, "\t", "\\t");
   return output;
}
//+------------------------------------------------------------------+
