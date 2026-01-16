// content.ts
console.log("Content script loaded");

type SegmentID = number;

interface Segment {
  id: SegmentID;
  start_time_ms: number;

  source: {
    stable: string;
    unstable: string;
    language?: string;
    is_final: boolean;
  };

  target: {
    stable: string;
    unstable: string;
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_INFO") {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
    };
    sendResponse(pageInfo);
    return true;
  }
});
