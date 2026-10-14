(() => {
  'use strict';

  const diagnosticAttribute = "data-flow-local-diagnostic";
  const consolePrefix = "[Charkh o Falak]";
  const specMessageType = "charkh-flow-spec";
  const specRequestMessageType = "charkh-flow-spec-request";
  const defaultSpec = {
    origin: "https://flow.google.com",
    path: "/_/AiSandboxAngularFrontend/data/batchexecute",
    rpcids: "cPZSdc",
    tag: "wrb.fr",
    flagIndex: 30,
    minLength: 32
  };
  function patchRpcResponse(responseText, spec) {
    const responseLines = responseText.split("\n");
    let originalFlagValue;
    let patchCount = 0;
    for (let lineIndex = 0; lineIndex < responseLines.length; lineIndex++) {
      if (!responseLines[lineIndex].startsWith("[[")) {
        continue;
      }
      let rpcEntries;
      try {
        rpcEntries = JSON.parse(responseLines[lineIndex]);
      } catch {
        continue;
      }
      let frameModified = false;
      for (const rpcEntry of rpcEntries) {
        if (!Array.isArray(rpcEntry) || rpcEntry[0] !== spec.tag || rpcEntry[1] !== spec.rpcids) {
          continue;
        }
        const configValues = JSON.parse(rpcEntry[2]);
        if (!Array.isArray(configValues) || configValues.length < spec.minLength || configValues[spec.flagIndex] !== null && typeof configValues[spec.flagIndex] !== "boolean") {
          throw Error("Unexpected config schema");
        }
        originalFlagValue = configValues[spec.flagIndex];
        configValues[spec.flagIndex] = true;
        patchCount++;
        rpcEntry[2] = JSON.stringify(configValues);
        frameModified = true;
      }
      if (frameModified) {
        const originalFrame = responseLines[lineIndex].replace(/\r$/, "");
        const declaredFrameLength = Number(responseLines[lineIndex - 1]);
        const utf8ByteLength = text => new TextEncoder().encode(text).length;
        const frameLengthCalculators = [utf8ByteLength, textValue => textValue.length];
        const frameLengthCalculator = frameLengthCalculators.find(calculateLength => [0, 1, 2].includes(declaredFrameLength - calculateLength(originalFrame)));
        if (!frameLengthCalculator) {
          throw Error("Unexpected frame length");
        }
        const patchedFrame = JSON.stringify(rpcEntries);
        responseLines[lineIndex - 1] = String(declaredFrameLength + frameLengthCalculator(patchedFrame) - frameLengthCalculator(originalFrame));
        responseLines[lineIndex] = patchedFrame;
      }
    }
    if (patchCount !== 1) {
      throw Error("Expected one config response");
    }
    return {
      body: responseLines.join("\n"),
      before: originalFlagValue
    };
  }
  if (typeof module === "object" && module.exports) {
    module.exports = {
      patch: responseBody => patchRpcResponse(responseBody, defaultSpec)
    };
    return;
  }
  if (window.__flowLocalDiagnostic) {
    return;
  }
  const diagnosticState = window.__flowLocalDiagnostic = {
    state: "awaiting-spec",
    applied: 0
  };
  function updateDiagnostic(nextState, previousFlagValue) {
    Object.assign(diagnosticState, {
      state: nextState,
      before: previousFlagValue
    });
    console.info(consolePrefix, JSON.stringify(diagnosticState));
    const publishDiagnostic = () => {
      document.documentElement.setAttribute(diagnosticAttribute, JSON.stringify(diagnosticState));
    };
    if (document.documentElement) {
      publishDiagnostic();
    } else {
      document.addEventListener("DOMContentLoaded", publishDiagnostic, {
        once: true
      });
    }
  }
  function validateFlowSpec(candidateSpec) {
    return candidateSpec && typeof candidateSpec === "object" && typeof candidateSpec.path === "string" && candidateSpec.path.startsWith("/") && typeof candidateSpec.rpcids === "string" && candidateSpec.rpcids.length > 0 && typeof candidateSpec.tag === "string" && candidateSpec.tag.length > 0 && Number.isInteger(candidateSpec.flagIndex) && candidateSpec.flagIndex >= 0 && Number.isInteger(candidateSpec.minLength) && candidateSpec.minLength > candidateSpec.flagIndex;
  }
  let activeSpec = null;
  let specResolved = false;
  const targetRequests = new WeakMap();
  const responseCache = new WeakMap();
  const xhrPrototype = XMLHttpRequest.prototype;
  const originalXhrOpen = xhrPrototype.open;
  xhrPrototype.open = function (httpMethod, requestUrlInput, ...remainingOpenArguments) {
    let isTargetRequest = false;
    try {
      const requestUrl = new URL(requestUrlInput, location.href);
      if (activeSpec) {
        isTargetRequest = requestUrl.origin === location.origin && requestUrl.pathname === activeSpec.path && requestUrl.searchParams.get("rpcids") === activeSpec.rpcids;
      } else {
        isTargetRequest = requestUrl.origin === location.origin && requestUrl.pathname.includes("/data/batchexecute");
      }
    } catch {}
    targetRequests.set(this, isTargetRequest);
    responseCache.delete(this);
    return Reflect.apply(originalXhrOpen, this, [httpMethod, requestUrlInput, ...remainingOpenArguments]);
  };
  for (const responseProperty of ["responseText", "response"]) {
    const originalResponseDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, responseProperty);
    if (!originalResponseDescriptor?.get || !originalResponseDescriptor.configurable) {
      continue;
    }
    Object.defineProperty(xhrPrototype, responseProperty, {
      ...originalResponseDescriptor,
      get() {
        const originalResponse = Reflect.apply(originalResponseDescriptor.get, this, []);
        if (!targetRequests.get(this) || typeof originalResponse !== "string") {
          return originalResponse;
        }
        if (!activeSpec) {
          diagnosticState.heldForSpec = true;
          if (this.readyState === 4 && specResolved) {
            return originalResponse;
          } else {
            return "";
          }
        }
        if (this.readyState === 3) {
          diagnosticState.heldPartial = true;
          return "";
        }
        if (this.readyState !== 4) {
          return originalResponse;
        }
        if (!responseCache.has(this)) {
          try {
            const patchedResult = patchRpcResponse(originalResponse, activeSpec);
            responseCache.set(this, patchedResult.body);
            diagnosticState.applied++;
            updateDiagnostic("applied", patchedResult.before);
          } catch {
            responseCache.set(this, originalResponse);
            updateDiagnostic("schema mismatch — unchanged");
          }
        }
        return responseCache.get(this);
      }
    });
  }
  window.addEventListener("message", messageEvent => {
    if (messageEvent.source !== window) {
      return;
    }
    const messageData = messageEvent.data;
    if (!messageData || messageData.type !== specMessageType) {
      return;
    }
    if (activeSpec) {
      return;
    }
    if (!validateFlowSpec(messageData.spec)) {
      if (messageData.spec === null) {
        specResolved = true;
        updateDiagnostic("spec unavailable — inert");
      } else {
        updateDiagnostic("spec invalid — inert");
      }
      return;
    }
    activeSpec = messageData.spec;
    specResolved = true;
    updateDiagnostic("armed");
  });
  let specRequestAttempts = 0;
  const requestSpecUntilAvailable = () => {
    if (activeSpec || specResolved || specRequestAttempts >= 40) {
      if (!activeSpec) {
        specResolved = true;
      }
      return;
    }
    specRequestAttempts++;
    window.postMessage({
      type: specRequestMessageType
    }, location.origin);
    setTimeout(requestSpecUntilAvailable, 500);
  };
  requestSpecUntilAvailable();
  updateDiagnostic("awaiting-spec");
})();
