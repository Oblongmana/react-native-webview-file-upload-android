package com.oblongmana.webviewfileuploadandroid;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;


import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.views.webview.ReactWebViewManager;
import com.oblongmana.webviewfileuploadandroid.AndroidWebViewModule;

public class AndroidWebViewManager extends ReactWebViewManager {

    private Activity mActivity = null;
    private AndroidWebViewPackage aPackage;
    public String getName() {
        return "AndroidWebView";
    }

    @Override
    protected WebView createViewInstance(ThemedReactContext reactContext) {
        WebView view = super.createViewInstance(reactContext);
        //Now do our own setWebChromeClient, patching in file chooser support
        final AndroidWebViewModule module = this.aPackage.getModule();
        view.setWebChromeClient(new WebChromeClient(){

            public void openFileChooser(ValueCallback<Uri> uploadMsg, String acceptType) {
                module.setUploadMessage(uploadMsg);
                openFileChooserView();

            }

            public boolean onJsConfirm (WebView view, String url, String message, JsResult result){
                return true;
            }

            public boolean onJsPrompt (WebView view, String url, String message, String defaultValue, JsPromptResult result){
                return true;
            }

            // For Android < 3.0
            public void openFileChooser(ValueCallback<Uri> uploadMsg) {
                module.setUploadMessage(uploadMsg);
                openFileChooserView();
            }

            // For Android  > 4.1.1
            public void openFileChooser(ValueCallback<Uri> uploadMsg, String acceptType, String capture) {
                module.setUploadMessage(uploadMsg);
                openFileChooserView();
            }

            // For Android > 5.0
            public boolean onShowFileChooser (WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                Log.d("customwebview", "onShowFileChooser");

                module.setmUploadCallbackAboveL(filePathCallback);
                openFileChooserView();
                return true;
            }

            private void openFileChooserView(){
                try {
                    final Intent galleryIntent = new Intent(Intent.ACTION_GET_CONTENT);
                    galleryIntent.addCategory(Intent.CATEGORY_OPENABLE);
                    galleryIntent.setType("*/*");
                    String[] extraMimeTypes = {"image/*", "video/*", "application/pdf"};
                    galleryIntent.putExtra(Intent.EXTRA_MIME_TYPES, extraMimeTypes);
                    final Intent chooserIntent = Intent.createChooser(galleryIntent, "Choose File");
                    module.getActivity().startActivityForResult(Intent.createChooser(galleryIntent, "File Browser"), 1);
                } catch (Exception e) {
                    Log.d("customwebview", e.toString());
                }
            }
        });
        return view;
    }

    public void setPackage(AndroidWebViewPackage aPackage){
        this.aPackage = aPackage;
    }

    public AndroidWebViewPackage getPackage(){
        return this.aPackage;
    }
}
