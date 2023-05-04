/**
 * WikiEdit is a tool for quickly editing paragraphs and other elements directly in the page
 *
 * Documentation: https://www.mediawiki.org/wiki/WikiEdit
 * License: GNU General Public License 3 or later (http://www.gnu.org/licenses/gpl-3.0.html)
 * Author: Felipe Schenone (User:Sophivorus)
 */
window.WikiEdit = {

	elements: 'p, li, caption, th, td',

	messages: {
		'wikiedit-edit': 'edit',
		'wikiedit-title-edit-paragraph': 'Edit this paragraph',
		'wikiedit-title-edit-list-item': 'Edit this list item',
		'wikiedit-title-edit-table-caption': 'Edit this table caption',
		'wikiedit-title-edit-table-header': 'Edit this table header',
		'wikiedit-title-edit-table-data': 'Edit this table data',
		'wikiedit-summary-edit-paragraph': 'Edit paragraph with [[$1|#wikiedit]]',
		'wikiedit-summary-delete-paragraph': 'Delete paragraph with [[$1|#wikiedit]]',
		'wikiedit-summary-edit-list-item': 'Edit list item with [[$1|#wikiedit]]',
		'wikiedit-summary-delete-list-item': 'Delete list item with [[$1|#wikiedit]]',
		'wikiedit-summary-edit-table-caption': 'Edit table caption with [[$1|#wikiedit]]',
		'wikiedit-summary-edit-table-header': 'Edit table header with [[$1|#wikiedit]]',
		'wikiedit-summary-edit-table-data': 'Edit table data with [[$1|#wikiedit]]',
	},

	init: function () {
		mw.messages.set( WikiEdit.messages );

		WikiEdit.loadCSS();

		WikiEdit.getPageWikitext().done( WikiEdit.addEditButtons );
	},

	/**
	 * Load CSS directly from Wikimedia repository and add it to the DOM
	 */
	loadCSS: function () {
		$.get( '//gerrit.wikimedia.org/r/plugins/gitiles/wikipedia/gadgets/ProveIt/+/master/wikiedit.css?format=text', function ( data ) {
			var css = atob( data );
			var $style = $( '<style>' ).html( css );
			$( 'head' ).append( $style );
		} );
	},

	/**
	 * Get the wikitext of the current page
	 */
	getPageWikitext: function () {
		var params = {
			'page': mw.config.get( 'wgPageName' ),
			'action': 'parse',
			'prop': 'wikitext',
			'formatversion': 2,
		};
		return new mw.Api().get( params ).done( function ( data ) {
			var pageWikitext = data.parse.wikitext;
			WikiEdit.pageWikitext = pageWikitext;
		} );
	},

	/**
	 * Add the edit buttons to the supported elements
	 *
	 * Note that the button behavior in Minerva is slightly different
	 * because on mobile devices there's no hover event
	 */
	addEditButtons: function () {
		var $elements = $( WikiEdit.elements, '#mw-content-text' );
		if ( mw.config.get( 'skin' ) === 'minerva' ) {
			$elements.each( WikiEdit.addEditButton );
			$elements.each( WikiEdit.showEditButton );
		} else {
			$elements.each( WikiEdit.addEditButton );
			$elements.on( 'mouseenter', WikiEdit.showEditButton );
			$elements.on( 'mouseleave', WikiEdit.hideEditButton );
		}
	},

	showEditButton: function () {
		$( this ).find( '.wikiedit-button' ).first().show();
	},

	hideEditButton: function () {
		$( this ).find( '.wikiedit-button' ).first().hide();
	},

	/**
	 * Add edit button
	 */
	addEditButton: function () {
		var $element = $( this );

		var relevantWikitext = WikiEdit.getRelevantWikitext( $element );
		if ( !relevantWikitext ) {
			return;
		}

		// Make the button
		var path = '<path fill="currentColor" d="M16.77 8l1.94-2a1 1 0 0 0 0-1.41l-3.34-3.3a1 1 0 0 0-1.41 0L12 3.23zm-5.81-3.71L1 14.25V19h4.75l9.96-9.96-4.75-4.75z"></path>';
		var icon = '<svg width="14" height="14" viewBox="0 0 20 20">' + path + '</svg>';
		var type = WikiEdit.getElementType( $element );
		var title = mw.message( 'wikiedit-title-edit-' + type );
		var $button = $( '<span hidden class="wikiedit-button noprint" title="' + title + '">' + icon + '</span>' );
		$button.on( 'click', WikiEdit.addEditForm );

		// Add to the DOM
		if ( type == 'list-item' && $element.children( 'ul, ol' ).length ) {
			$element.children( 'ul, ol' ).before( ' ', $button );
		} else {
			$element.append( ' ', $button );
		}
	},

	/**
	 * Add edit form
	 */
	addEditForm: function () {
		var $link = $( this );

		var $element = $link.closest( WikiEdit.elements );
		var $original = $element.clone( true ); // Save it in case we need to restore it later

		// Get the relevant wikitext
		var relevantWikitext = WikiEdit.getRelevantWikitext( $element );

		// Make the form
		var $form = $( '<div class="wikiedit-form"></div>' );
		var $input = $( '<div class="wikiedit-form-input" contenteditable="true"></div>' ).text( relevantWikitext );
		var $footer = $( '<div class="wikiedit-form-footer"></div>' );
		var $submit = $( '<button class="wikiedit-form-submit mw-ui-button mw-ui-progressive">Save</button>' );
		var $cancel = $( '<button class="wikiedit-form-cancel mw-ui-button">Cancel</button>' );
		$footer.append( $submit, $cancel );
		$form.append( $input, $footer );

		// Add to the DOM
		$element.html( $form );
		$input.focus();

		// Handle the submit
		$submit.on( 'click', {
			'element': $element,
			'original': $original,
			'relevantWikitext': relevantWikitext
		}, WikiEdit.onSubmit );

		// Handle the cancel
		$cancel.on( 'click', function () {
			$element.replaceWith( $original );
		} );

		return false;
	},

	onSubmit: function ( event ) {
		var $submit = $( this );
		var $footer = $submit.closest( '.wikiedit-form-footer' );
		var $form = $submit.closest( '.wikiedit-form' );
		$footer.text( 'Saving...' );
		var $element = event.data.element;
		var oldWikitext = event.data.relevantWikitext;
		var newWikitext = $form.find( '.wikiedit-form-input' ).prop( 'innerText' ); // jQuery's text() removes line breaks
		if ( oldWikitext === newWikitext ) {
			var $original = event.data.original;
			$element.replaceWith( $original );
			return;
		}

		WikiEdit.pageWikitext = WikiEdit.pageWikitext.replace( oldWikitext, newWikitext );
		var params = {
			'action': 'edit',
			'title': mw.config.get( 'wgPageName' ),
			'text': WikiEdit.pageWikitext,
			'summary': WikiEdit.makeSummary( $element, newWikitext ),
			'tags': 'wikiedit',
		};
		var api = new mw.Api();
		if ( mw.config.get( 'wgUserName' ) ) {
			api.postWithEditToken( params ).done( function () {
				WikiEdit.onSuccess( $element, newWikitext );
			} );
		} else {
			api.login(
				'Anon@WikiEdit',
				'a5ehsatdosjes8spfgdpvisgki20avgs'
			).done( function () {
				api.postWithEditToken( params ).done( function () {
					WikiEdit.onSuccess( $element, newWikitext );
				} );
			} );
		}
	},

	onSuccess: function ( $element, newWikitext ) {
		var params = {
			'action': 'parse',
			'title': mw.config.get( 'wgPageName' ),
			'text': newWikitext,
			'formatversion': 2,
			'prop': 'text',
			'wrapoutputclass': null,
			'disablelimitreport': true,
		};
		new mw.Api().get( params ).done( function ( data ) {
			var text = data.parse.text;
			var html = $( text ).html();
			$element.html( html );
		} );
	},

	/**
	 * Helper method to build an adequate edit summary
	 */
	makeSummary: function ( element, inputWikitext ) {
		var action = 'edit';
		if ( !inputWikitext ) {
			action = 'delete';
		}
		var type = WikiEdit.getElementType( element );
		var link = 'mw:WikiEdit';
		if ( mw.config.get( 'wikiedit-link' ) ) {
			link = mw.config.get( 'wikiedit-link' );
		}
		var summary = mw.message( 'wikiedit-summary-' + action + '-' + type, link ).text();
		return summary;
	},

	/**
	 * Helper method to get the relevant wikitext that corresponds to a given DOM element
	 * 
	 * This is actualy the heart of the tool
	 * It's an heuristic method to try to find the relevant wikitext
	 * that corresponds to the DOM element being edited
	 * Since wikitext and HTML are different markups
	 * the only place where they are identical is in plain text
	 * so we find the longest fragment of plain text in the HTML
	 * and then we use that to find the corresponding wikitext
	 *
	 * @param {jQuery object} jQuery object representing the DOM element to be edited
	 * @return {string|null} Relevant wikitext of the element to be edited, or null if it can't be found
	 */
	getRelevantWikitext: function ( $element ) {

		// Get the text of longest text node
		// because it has the most chances of being unique
		var $textNodes = $element.contents().filter( function () {
			return this.nodeType === Node.TEXT_NODE;
		} );
		var longestText = '';
		$textNodes.each( function () {
			var nodeText = $( this ).text().trim();
			if ( nodeText.length > longestText.length ) {
				longestText = nodeText;
			}
		} );

		// Some elements don't have text nodes
		// for example list items with just a link
		if ( !longestText ) {
			return;
		}

		// Build a regex pattern that matches the relevant wikitext
		var type = WikiEdit.getElementType( $element );
		var prefix;
		switch ( type ) {
			case 'paragraph':
				prefix = '';
				break;
			case 'list-item':
				prefix = '[*#]+ *';
				break;
			case 'table-caption':
				prefix = '\\|\\+ *';
				break;
			case 'table-header':
				prefix = '! *';
				break;
			case 'table-data':
				prefix = '\\| *';
				break;
		}
		longestText = longestText.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ); // Escape special characters
		var regexp = new RegExp( prefix + '(.*' + longestText + '.*)', 'g' );
		var matches = WikiEdit.pageWikitext.match( regexp );

		// In theory this should never happen
		if ( !matches ) {
			return;
		}

		// This instead may happen often
		// for example in tables where several cells contain the same text
		// or when the longest text node is very short and common
		if ( matches.length > 1 ) {
			return;
		}

		matches = regexp.exec( WikiEdit.pageWikitext );
		return matches[1];
	},

	/**
     * Helper method to get the type of element
     *
     * @param {jQuery object}
     * @return {string}
     */
    getElementType: function ( $element ) {
		var tag = $element.prop( 'tagName' );
		switch ( tag ) {
			case 'P':
				return 'paragraph';
			case 'LI':
				return 'list-item';
			case 'CAPTION':
				return 'table-caption';
			case 'TH':
				return 'table-header';
			case 'TD':
				return 'table-data';
		}
	}
};

$( WikiEdit.init );
