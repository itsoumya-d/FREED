package app.freed.qawebview;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class WebViewFixtureActivity extends Activity {
  private static final String NORMAL_URL = "https://youtube.com/results?search_query=workout";
  private static final String ADULT_TEST_URL = "https://porn-videos.freedrecovery.app";

  private EditText urlField;
  private WebView webView;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(32, 32, 32, 32);

    TextView title = new TextView(this);
    title.setText("FREED WebView Fixture");
    title.setTextSize(22);
    title.setGravity(Gravity.START);
    root.addView(title, new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    ));

    TextView helper = new TextView(this);
    helper.setText("Use this QA-only app to validate FREED's focused WebView URL-field interception.");
    helper.setTextSize(14);
    helper.setPadding(0, 12, 0, 20);
    root.addView(helper, new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    ));

    urlField = new EditText(this);
    urlField.setSingleLine(true);
    urlField.setHint(NORMAL_URL);
    urlField.setText(NORMAL_URL);
    urlField.setSelectAllOnFocus(true);
    urlField.setImportantForAccessibility(EditText.IMPORTANT_FOR_ACCESSIBILITY_YES);
    root.addView(urlField, new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    ));

    LinearLayout actions = new LinearLayout(this);
    actions.setOrientation(LinearLayout.HORIZONTAL);
    actions.setPadding(0, 16, 0, 16);

    Button normalButton = new Button(this);
    normalButton.setText("Normal");
    normalButton.setOnClickListener((_view) -> loadFixtureUrl(NORMAL_URL));
    actions.addView(normalButton, new LinearLayout.LayoutParams(
      0,
      ViewGroup.LayoutParams.WRAP_CONTENT,
      1
    ));

    Button adultButton = new Button(this);
    adultButton.setText("Adult Test");
    adultButton.setOnClickListener((_view) -> {
      urlField.requestFocus();
      urlField.setText(ADULT_TEST_URL);
      urlField.setSelection(urlField.length());
    });
    actions.addView(adultButton, new LinearLayout.LayoutParams(
      0,
      ViewGroup.LayoutParams.WRAP_CONTENT,
      1
    ));

    Button loadButton = new Button(this);
    loadButton.setText("Load");
    loadButton.setOnClickListener((_view) -> loadFixtureUrl(urlField.getText().toString()));
    actions.addView(loadButton, new LinearLayout.LayoutParams(
      0,
      ViewGroup.LayoutParams.WRAP_CONTENT,
      1
    ));

    root.addView(actions, new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    ));

    webView = new WebView(this);
    webView.getSettings().setJavaScriptEnabled(false);
    webView.loadDataWithBaseURL(
      "https://fixture.freed.local",
      "<html><body><h1>FREED QA WebView</h1><p>Normal browsing should remain allowed. Adult test URLs should hand off to FREED when the URL field is focused.</p></body></html>",
      "text/html",
      "UTF-8",
      null
    );
    root.addView(webView, new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      0,
      1
    ));

    setContentView(root);
  }

  private void loadFixtureUrl(String value) {
    String url = value == null ? "" : value.trim();
    if (url.isEmpty()) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    urlField.setText(url);
    webView.loadUrl(url);
  }
}
