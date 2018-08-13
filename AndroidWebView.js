/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule AndroidWebView
 */
import React, {
  Component,
} from 'react';
import PropTypes from 'prop-types';
import ReactNative, {
  EdgeInsetsPropType,
  ActivityIndicator,
  StyleSheet,
  UIManager,
  View,
  requireNativeComponent,
} from 'react-native';
import warning from 'warning';
import keyMirror from 'keymirror';
import resolveAssetSource from 'react-native/Libraries/Image/resolveAssetSource';

/**
 * Adds a function for warning Users of deprecated prop use (when something was
 * valid in previous versions of a component, but not any more).
 *
 * In a fit of hilarious irony, the built in React deprecatedPropType used for
 *  warning users about deprecated PropTypes, has itself been deprecated, and
 *  this fact is terribly documented (or at least the SEO is subpar), with most
 *  of the "documentation" found through google being users being caught out by
 *  this change.
 *  https://facebook.github.io/react/warnings/dont-call-proptypes.html sort of
 *  contains a replacement, but not fully documented (e.g. no declaration of
 *  the 'warned' const). Finding the fix for this was a great experience
 *  all round, would recommend.
 */
const warned = {};
export default function deprecatedPropType(propType, explanation) {
  return function validate(props, propName, componentName, ...rest) { // Note ...rest here
    if (props[propName] != null) {
      const message = `"${propName}" property of "${componentName}" has been deprecated.\n${explanation}`;
      if (!warned[message]) {
        warning(false, message);
        warned[message] = true;
      }
    }

    return propType(props, propName, componentName, ...rest); // and here
  };
}


const RCT_WEBVIEW_REF = 'AndroidWebView';


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hidden: {
    height: 0,
    flex: 0, // disable 'flex:1' when hiding a View
  },
  loadingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingProgressBar: {
    height: 20,
  },
});

const WebViewState = keyMirror({
  IDLE: null,
  LOADING: null,
  ERROR: null,
});

/**
 * Renders a native AndroidWebView that allows file upload.
 */
class AndroidWebView extends Component {
  static propTypes = {
    ...View.propTypes,
    renderError: PropTypes.func,
    renderLoading: PropTypes.func,
    onLoad: PropTypes.func,
    onLoadEnd: PropTypes.func,
    onLoadStart: PropTypes.func,
    onError: PropTypes.func,
    automaticallyAdjustContentInsets: PropTypes.bool,
    saveFormDataDisabled: PropTypes.bool,
    thirdPartyCookiesEnabled: PropTypes.bool,
    urlPrefixesForDefaultIntent: PropTypes.array,
    mixedContentMode: PropTypes.string,
    contentInset: EdgeInsetsPropType,
    onNavigationStateChange: PropTypes.func,
    onMessage: PropTypes.func,
    onContentSizeChange: PropTypes.func,
    startInLoadingState: PropTypes.bool, // force WebView to show loadingView on first load

    html: deprecatedPropType(
      PropTypes.string,
      'Use the `source` prop instead.',
    ),

    url: deprecatedPropType(
      PropTypes.string,
      'Use the `source` prop instead.',
    ),

    /**
     * Loads static html or a uri (with optional headers) in the WebView.
     */
    source: PropTypes.oneOfType([
      PropTypes.shape({
        /*
         * The URI to load in the WebView. Can be a local or remote file.
         */
        uri: PropTypes.string,
        /*
         * The HTTP Method to use. Defaults to GET if not specified.
         * NOTE: On Android, only GET and POST are supported.
         */
        method: PropTypes.oneOf(['GET', 'POST']),
        /*
         * Additional HTTP headers to send with the request.
         * NOTE: On Android, this can only be used with GET requests.
         */
        headers: PropTypes.object,
        /*
         * The HTTP body to send with the request. This must be a valid
         * UTF-8 string, and will be sent exactly as specified, with no
         * additional encoding (e.g. URL-escaping or base64) applied.
         * NOTE: On Android, this can only be used with POST requests.
         */
        body: PropTypes.string,
      }),
      PropTypes.shape({
        /*
         * A static HTML page to display in the WebView.
         */
        html: PropTypes.string,
        /*
         * The base URL to be used for any relative links in the HTML.
         */
        baseUrl: PropTypes.string,
      }),
      /*
       * Used internally by packager.
       */
      PropTypes.number,
    ]),

    /**
     * Used on Android only, JS is enabled by default for WebView on iOS
     * @platform android
     */
    javaScriptEnabled: PropTypes.bool,

    /**
     * Used on Android only, controls whether DOM Storage is enabled or not
     * @platform android
     */
    domStorageEnabled: PropTypes.bool,

    /**
     * Sets the JS to be injected when the webpage loads.
     */
    injectedJavaScript: PropTypes.string,

    /**
     * Sets whether the webpage scales to fit the view and the user can change the scale.
     */
    scalesPageToFit: PropTypes.bool,

    /**
     * Sets the user-agent for this WebView. The user-agent can also be set in native using
     * WebViewConfig. This prop will overwrite that config.
     */
    userAgent: PropTypes.string,

    /**
     * Used to locate this view in end-to-end tests.
     */
    testID: PropTypes.string,

    /**
     * Determines whether HTML5 audio & videos require the user to tap before they can
     * start playing. The default value is `false`.
     */
    mediaPlaybackRequiresUserAction: PropTypes.bool,
    /**
     * Make upload file available
     */
    uploadEnabledAndroid: PropTypes.bool,

    /**
     * Boolean that sets whether JavaScript running in the context of a file
     * scheme URL should be allowed to access content from any origin.
     * Including accessing content from other file scheme URLs
     * @platform android
     */
    allowUniversalAccessFromFileURLs: PropTypes.bool,
  };

  static defaultProps = {
    javaScriptEnabled: true,
    scalesPageToFit: true,
  };

  state = {
    viewState: WebViewState.IDLE,
    lastErrorEvent: null,
  };

  onLoadingStart = (event) => {
    const onLoadStart = this.props.onLoadStart;
    onLoadStart && onLoadStart(event);
    this.updateNavigationState(event);
  };

  onLoadingError = (event) => {
    event.persist(); // persist this event because we need to store it
    const { onError, onLoadEnd } = this.props;
    onError && onError(event);
    onLoadEnd && onLoadEnd(event);
    console.warn('Encountered an error loading page', event.nativeEvent);

    this.setState({
      lastErrorEvent: event.nativeEvent,
      viewState: WebViewState.ERROR,
    });
  };

  onLoadingFinish = (event) => {
    const { onLoad, onLoadEnd } = this.props;
    onLoad && onLoad(event);
    onLoadEnd && onLoadEnd(event);
    this.setState({
      viewState: WebViewState.IDLE,
    });
    this.updateNavigationState(event);
  };

  onMessage = (event: Event) => {
    const { onMessage } = this.props;
    onMessage && onMessage(event);
  }

  getWebViewHandle = () => ReactNative.findNodeHandle(this[RCT_WEBVIEW_REF]);


  goForward = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.RCTWebView.Commands.goForward,
      null,
    );
  };

  goBack = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.RCTWebView.Commands.goBack,
      null,
    );
  };

  postMessage = (data) => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.RCTWebView.Commands.postMessage,
      [String(data)],
    );
  };

  reload = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.RCTWebView.Commands.reload,
      null,
    );
  };

  stopLoading = () => {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewHandle(),
      UIManager.RCTWebView.Commands.stopLoading,
      null,
    );
  };

  /**
  * We return an event with a bunch of fields including:
  *  url, title, loading, canGoBack, canGoForward
  */
  updateNavigationState = (event) => {
    if (this.props.onNavigationStateChange) {
      this.props.onNavigationStateChange(event.nativeEvent);
    }
  };

  render() {
    const otherView = null;

    const webViewStyles = [styles.container, this.props.style];
    if (this.state.viewState === WebViewState.LOADING ||
      this.state.viewState === WebViewState.ERROR) {
      // if we're in either LOADING or ERROR states, don't show the webView
      webViewStyles.push(styles.hidden);
    }

    const source = this.props.source || {};
    if (this.props.html) {
      source.html = this.props.html;
    } else if (this.props.url) {
      source.uri = this.props.url;
    }

    if (source.method === 'POST' && source.headers) {
      console.warn('WebView: `source.headers` is not supported when using POST.');
    } else if (source.method === 'GET' && source.body) {
      console.warn('WebView: `source.body` is not supported when using GET.');
    }

    const webView = (
      <WebViewForAndroid
        ref={(c) => { this[RCT_WEBVIEW_REF] = c; }}
        key="androidwebViewKey"
        style={webViewStyles}
        source={resolveAssetSource(source)}
        scalesPageToFit={this.props.scalesPageToFit}
        injectedJavaScript={this.props.injectedJavaScript}
        userAgent={this.props.userAgent}
        javaScriptEnabled={this.props.javaScriptEnabled}
        domStorageEnabled={this.props.domStorageEnabled}
        messagingEnabled={typeof this.props.onMessage === 'function'}
        onMessage={this.onMessage}
        contentInset={this.props.contentInset}
        automaticallyAdjustContentInsets={this.props.automaticallyAdjustContentInsets}
        onContentSizeChange={this.props.onContentSizeChange}
        onLoadingStart={this.onLoadingStart}
        onLoadingFinish={this.onLoadingFinish}
        onLoadingError={this.onLoadingError}
        testID={this.props.testID}
        mediaPlaybackRequiresUserAction={this.props.mediaPlaybackRequiresUserAction}
        uploadEnabledAndroid={true}
      />
    );

    return (
      <View style={styles.container}>
        {webView}
      </View>
    );
  }
}

const WebViewForAndroid = requireNativeComponent('AndroidWebView', AndroidWebView, {
  nativeOnly: {
    messagingEnabled: PropTypes.bool,
  },
});


module.exports = AndroidWebView;
