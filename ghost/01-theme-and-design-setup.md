# Theme & Visual Setup for ai.reletix.com

## 1. Base Theme Selection
To get started with the foundation:
1. Export the current theme from **talent.reletix.com** via Ghost Admin (`Settings` -> `Design` -> `Change Theme` -> `Advanced` -> `Download`).
2. Upload and activate this zip file on **ai.reletix.com**.

## 2. Implementing the Author Box (ReadTangle Style)
To show the author's picture, their profile, and a link to all the articles they wrote at the bottom of every post:

1. Unzip your downloaded theme on your local machine.
2. Open the `post.hbs` file (this template handles individual articles).
3. Find where the `{{content}}` tag ends, and paste the following Handlebars snippet right below it:

```handlebars
{{#author}}
<div class="custom-author-box">
    {{#if profile_image}}
        <img class="author-profile-image" src="{{img_url profile_image size="s"}}" alt="{{name}}" />
    {{/if}}
    <div class="author-details">
        <h4><a href="{{url}}">{{name}}</a></h4>
        {{#if bio}}
            <p>{{bio}}</p>
        {{/if}}
        <a class="author-read-more" href="{{url}}">View all articles by {{name}} &rarr;</a>
    </div>
</div>
{{/author}}
```

4. Add the accompanying CSS. You can add this into your theme's main CSS file (e.g., `assets/css/screen.css`) OR simply paste it into Ghost Admin under `Settings` -> `Code injection` -> `Site Header`:

```html
<style>
.custom-author-box {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 32px;
    background: #f8f9fa; /* Sleek light grey */
    border-radius: 12px;
    margin-top: 48px;
    margin-bottom: 48px;
    border: 1px solid #eaeaea;
}
.author-profile-image {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
}
.author-details h4 { 
    margin: 0 0 8px 0; 
    font-size: 1.2rem;
}
.author-details h4 a {
    color: #111;
    text-decoration: none;
}
.author-details p { 
    margin: 0 0 12px 0; 
    font-size: 0.95em; 
    color: #555; 
    line-height: 1.5;
}
.author-read-more { 
    font-weight: 600; 
    color: var(--ghost-accent-color, #007bff); 
    text-decoration: none; 
    font-size: 0.9em;
}
.author-read-more:hover {
    text-decoration: underline;
}
</style>
```

## 3. Premium Community Aesthetics (Product Marketing Alliance Style)
To match the dynamic, contributor-heavy community vibe:
- **Hero Section:** Update the `index.hbs` (homepage) to feature a strong "Hero" banner explaining: *"RELETIX AI: Where founders and engineers build in public."*
- **Grid Layout:** Make sure the post feed on the homepage is a multi-column CSS grid (like cards) rather than a single vertical blog list. This distributes visual weight and makes it feel like an archive of resources.
- **Typography:** Ensure a modern sans-serif font like *Inter* or *Outfit* is configured in your CSS to give it a tech-startup tier execution.
- **Contributor Highlighting:** Consider adding a "Top Contributors" section on the homepage by hardcoding or querying users in Ghost.
