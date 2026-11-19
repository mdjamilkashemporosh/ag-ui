import { ChatDeepSeek } from "@langchain/deepseek";
import { tool } from "@langchain/core/tools";
import { AIMessage } from "@langchain/core/messages";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";

// Example tool
const getWeather = tool(async ({ city }) => `It's 28°C and sunny in ${city}.`, {
  name: "get_weather",
  description: "Get the current weather for a city",
  schema: z.object({ city: z.string() }),
});

const tools = [getWeather];

// Use deepseek-chat (deepseek-reasoner is not ideal for tool calling)
const model = new ChatDeepSeek({
  model: "deepseek-chat",
  temperature: 0,
}).bindTools(tools);

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

function shouldContinue(state: typeof MessagesAnnotation.State) {
  const last = state.messages[state.messages.length - 1] as AIMessage;
  return last.tool_calls?.length ? "tools" : END;
}

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent")
  .compile();
